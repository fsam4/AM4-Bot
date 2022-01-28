import { MessageEmbed, Permissions, MessageAttachment, MessageActionRow, MessageButton, Formatters, Constants, type MessageComponentInteraction, type Message, type ApplicationCommandOptionChoice } from 'discord.js';
import DiscordClientError from '../error';
import * as Utils from '../../utils';
import { emojis } from '../../../config.json';
import Route from '../../../src/classes/route';
import Plane from '../../../src/lib/plane';

import type { Settings, AM4_Data, BaseDocument } from '@typings/database';
import type { Document, Filter } from 'mongodb';
import type { SlashCommand } from '@discord/types';

type SeatType = "Y" | "J" | "F" | "L" | "H";

interface RouteDocument extends BaseDocument {
    totalPax: number;
    totalCargo: number;
    distance: number;
    flights: number;
    profit: number;
    sv: number;
    preference: any[];
    configuration: Record<SeatType, number>;
    demand: Record<SeatType, number>;
    arrival: AM4_Data.airport;
    stopover?: AM4_Data.airport;
    ticket: {
        realism: Record<SeatType, number>;
        easy: Record<SeatType, number>;
    };
}

const R = 6371 * (Math.pow(10, 3));
const P = (Math.PI / 180);

const { createAirportFilter, createPlaneFilter } = Utils.MongoDB;
const { formatCode, formatSeats } = Utils.Discord;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.ATTACH_FILES
    ]),
    data: {
        name: 'routes',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Search for the best routes from a hub with a plane",
        defaultPermission: true,
        options: [
            {
                name: 'departure',
                description: 'The ICAO/IATA code or ID of the departure airport',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                autocomplete: true,
                required: true
            },
            {
                name: 'plane',
                description: 'The plane to search the routes for',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                autocomplete: true,
                required: true
            },
            {
                name: 'flights',
                description: 'The amount of flights per day',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 1,
                required: false
            },
            {
                name: 'min_distance',
                description: 'The minimum distance of the routes. By default 100km.',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 100,
                required: false
            },
            {
                name: 'max_distance',
                description: 'The maximum distance of the routes. By default the range of the plane multiplied by 2.',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 100,
                required: false
            },
            {
                name: 'reputation',
                description: 'The reputation you want to use for configuration (10-100). By default 100.',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 10,
                maxValue: 100,
                required: false
            },
            {
                name: 'cost_index',
                description: 'The cost index you want to use (0-200). By default 200.',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 0,
                maxValue: 200,
                required: false
            },
            {
                name: '4x',
                description: 'Whether to use 4x boost on this route',
                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                required: false
            },
            {
                name: 'mode',
                description: 'The game mode to use when searching for routes. By default the mode of your airline.',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
                choices: [
                    {
                        name: "Realism",
                        value: "realism"
                    },
                    {
                        name: "Easy",
                        value: "easy"
                    }
                ]
            },
            {
                name: 'limit',
                description: 'The maximum amount (10-250) of routes to return. By default 100.',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                minValue: 10,
                maxValue: 250,
                required: false
            }
        ]
    },
    async execute(interaction, { rest, database, ephemeral, locale }) {
        await interaction.deferReply({ ephemeral });
        try {
            const planeSettings = database.settings.collection<Settings.plane>('Planes');
            const settings = database.settings.collection<Settings.user>('Users');
            const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
            const routeCollection = database.am4.collection<AM4_Data.route>('Routes');
            const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
            const user = new Utils.User(interaction.user.id, await settings.findOne({ id: interaction.user.id }));
            type GameMode = "realism" | "easy";
            type FollowUpOptions = Parameters<typeof interaction.followUp>[0];
            const followups: FollowUpOptions[] = [];
            const mode = interaction.options.getString("mode")?.trim();
            if (mode && mode === user.mode) followups.push({
                content: "🪙 When you have logged in you do not need to define the game mode anymore as it will be automatically filled for you.",
                ephemeral: true
            });
            if (mode) user.mode = <GameMode>mode;
            if (!user.mode) throw new DiscordClientError('You need to define the game mode or save it by logging in with `/user login`...');
            const reputation = interaction.options.getInteger("reputation");
            const cost_index = interaction.options.getInteger("cost_index") ?? user.options.cost_index
            const planeName = interaction.options.getString("plane", true).trim();
            const plane = await planeCollection.findOne(createPlaneFilter(planeName));
            if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
            const min_distance = interaction.options.getInteger("min_distance") || 100;
            const max_distance = interaction.options.getInteger("max_distance") || plane.range * 2;
            if (min_distance < 100 || min_distance > plane.range * 2) throw new DiscordClientError(`The minimum distance needs to be more than 100km and less than the plane's maximum range with stopover (${(plane.range * 2).toLocaleString(locale)}km)!`);
            if (max_distance < 100 || max_distance > plane.range * 2) throw new DiscordClientError(`The maximum distance needs to be more than 100km and less than the plane's maximum range with stopover (${(plane.range * 2).toLocaleString(locale)}km)!`);
            const plane_settings = await planeSettings.findOne({ 
                planeID: plane._id, 
                id: interaction.user.id 
            });
            if (plane.type === "vip" && user.options.show_warnings) followups.push({
                content: "⚠️ The VIP ticket prices are still experimental. Use them at your own risk!",
                ephemeral: true
            });
            let engineName: string;
            if (plane_settings) {
                if (plane_settings.engine) {
                    const engine = plane.engines.find(engine => engine.name === plane_settings.engine);
                    engineName = engine.name;
                    plane.speed = engine.speed;
                    plane.fuel = engine.fuel;
                }
                const modifications = plane_settings.modifications;
                if (modifications.speed) plane.speed *= 1.1;
                if (modifications.fuel) plane.fuel *= 0.9;
                if (modifications.co2) plane.co2 *= 0.9;
            } else if (user.options.show_tips) {
                followups.push({
                    content: "🪙 You can configure settings for the plane via `/plane settings`. Configuring settings for planes is recommended as on default they use market statistics.",
                    ephemeral: true
                });
            }
            if (user.mode === "easy") {
                plane.A_check.price /= 2;
                plane.speed *= 1.5;
            }
            plane.fuel *= (100 - user.training.fuel) / 100;
            plane.co2 *= (100 - user.training.co2) / 100;
            if (typeof cost_index === "number") {
                const speed = plane.speed / 2;
                plane.speed = Math.round(speed + speed * (cost_index / 200));
            }
            if (interaction.options.getBoolean("4x")) plane.speed *= 4;
            const pref = user.preference[plane.type === "cargo" ? "cargo" : "pax"];
            const departureCode = interaction.options.getString("departure", true).trim();
            const departure = await airportCollection.findOne(createAirportFilter(departureCode));
            if (!departure) throw new DiscordClientError(`That is not a valid departure airport...`);
            const flights = interaction.options.getInteger("flights");
            const limit = interaction.options.getInteger("limit") || 100;
            const postCalculationMatch: Document[] = [
                {
                    $gte: ['$distance', min_distance]
                },
                {
                    $lte: ['$distance', max_distance]
                },
                {
                    $cond: {
                        if: { $eq: [ plane.type, 'cargo' ] },
                        then: {
                            $gte: [
                                '$totalCargo',
                                {
                                    $multiply: [
                                        plane.capacity * ((reputation || 100) / 100), 
                                        '$flights'
                                    ] 
                                }
                            ]
                        },
                        else: {
                            $gte: [
                                '$totalPax',
                                {
                                    $multiply: [
                                        plane.capacity * ((reputation || 100) / 100), 
                                        '$flights'
                                    ] 
                                }
                            ]
                        }
                    }
                }
            ];
            if (user.mode === "realism") {
                postCalculationMatch.push({
                    $gte: [
                        '$arrival.runway',
                        plane.runway
                    ]
                });
            }
            if (flights) {
                postCalculationMatch.push({
                    $lte: [
                        user.options.activity,
                        {
                            $floor: {
                                $multiply: [
                                    flights,
                                    {
                                        $divide: [
                                            "$distance",
                                            plane.speed
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                });
            }
            const pipeline: Document[] = [
                {
                    $match: {
                        airports: departure._id
                    }
                },
                {
                    $lookup: {
                        from: 'Airports',
                        let: {
                            departure: { $arrayElemAt: ["$airports", 0] },
                            arrival: { $arrayElemAt: ["$airports", 1] }
                        },
                        pipeline: [
                            {
                                $match: { 
                                    $expr: {
                                        $eq: [ 
                                            "$id", 
                                            { 
                                                $cond: {
                                                    if: { $eq: ['$$departure', departure._id] },
                                                    then: "$$arrival",
                                                    else: "$$departure"
                                                }
                                            } 
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'arrival'
                    }
                },
                {
                    $unwind: '$arrival'
                },
                {
                    $addFields: {
                        totalPax: { $add: ['$demand.Y', { $multiply: ['$demand.J', 2] }, { $multiply: ['$demand.F', 3] }] },
                        totalCargo: { $round: { $add: ['$demand.H', { $multiply: ['$demand.L', 10 / 7] }] } },
                        distance: {
                            $round: [
                                {
                                    $divide: [
                                        {
                                            $multiply: [ R, 
                                                { 
                                                    $acos: { 
                                                        $add: [
                                                            { 
                                                                $multiply: [
                                                                    { $sin: { $multiply: [departure.location.coordinates[1], P] } },
                                                                    { $sin: { $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 1 ] }, P] } }
                                                                ] 
                                                            },
                                                            { 
                                                                $multiply: [
                                                                    { $cos: { $multiply: [departure.location.coordinates[1], P] } },
                                                                    { $cos: { $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 1 ] }, P] } },
                                                                    { $cos: { $subtract: [{ $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 0 ] }, P] }, { $multiply: [departure.location.coordinates[0], P] }] } }
                                                                ] 
                                                            }
                                                        ] 
                                                    } 
                                                } 
                                            ]
                                        }, 1000
                                    ]
                                }, 0
                            ]
                        },
                    }
                },
                {
                    $addFields: {
                        flights: flights || {
                            $add: [
                                {
                                    $floor: { 
                                        $divide: [
                                            user.options.activity, 
                                            { $divide: ['$distance', plane.speed] }
                                        ] 
                                    }
                                }, 1
                            ]
                        }
                    }
                },
                {
                    $match: {
                        $expr: {
                            $and: postCalculationMatch
                        }
                    }
                },
                {
                    $sort: plane.type === "cargo" ? { totalCargo: -1 } : { totalPax: -1 }
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        'arrival.gps': false,
                        airports: false
                    }
                }
            ];
            let routes = await routeCollection.aggregate<RouteDocument>(pipeline, { allowDiskUse: true }).toArray();
            if (!routes.length) throw new DiscordClientError('Could not find any suitable routes with your criteria...');
            const arrivalIds = new Set(routes.map(({ arrival }) => arrival._id));
            routes = [...arrivalIds].map(arrivalId => routes.find(route => route.arrival._id.equals(arrivalId)));
            const airports = await airportCollection.find().toArray();
            routes.forEach(function (route, index) {
                const originalDistance = route.distance;
                if (route.distance > plane.range) {
                    const centerPoint: [number, number] = [
                        (departure.location.coordinates[0] + route.arrival.location.coordinates[0]) / 2,
                        (departure.location.coordinates[1] + route.arrival.location.coordinates[1]) / 2
                    ];
                    const maxDistanceFromCenter = Route.preciseDistance(departure.location.coordinates, centerPoint).distance;
                    const validAirports = airports.filter(airport => {
                        const distanceToCenter = Route.preciseDistance(airport.location.coordinates, centerPoint).distance;
                        return distanceToCenter <= maxDistanceFromCenter;
                    });
                    const stopovers = Route.findStopovers([departure, route.arrival], validAirports, plane, user.mode);
                    if (!stopovers.length) {
                        delete this[index];
                        return;
                    }
                    const [stopover] = stopovers;
                    route.distance = stopover.distance;
                    const lastIndex = stopover.airports.length - 1;
                    const [stopoverAirport] = stopover.airports.slice(1, lastIndex);
                    route.stopover = stopoverAirport;
                }
                const { preference, configuration } = Route.configure(plane, {
                    options: {
                        activity: user.options.activity,
                        flights: route.flights,
                        reputation: reputation,
                        preference: pref,
                        mode: user.mode 
                    },
                    route: {
                        demand: route.demand, 
                        distance: route.distance
                    }
                });
                route.preference = preference;
                route.configuration = configuration;
                const options = {
                    options: {
                        activity: user.options.activity,
                        fuel_price: user.options.fuel_price,
                        co2_price: user.options.co2_price,
                        reputation: reputation || 100,
                        mode: user.mode
                    },
                    route: {
                        configuration: configuration,
                        distance: originalDistance,
                        flights: route.flights
                    }
                };
                route.profit = Route.profit(plane, options).profit;
                const estimatedSV = Route.estimatedShareValueGrowth(plane, options);
                route.sv = estimatedSV / route.flights;
                route.ticket = {
                    realism: Route.ticket(originalDistance, 'realism', plane.type === "vip"),
                    easy: Route.ticket(originalDistance, 'easy', plane.type === "vip")
                };
            }, routes);
            routes.filter(route => route !== undefined);
            routes.sort((a, b) => b.profit - a.profit);
            const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
            const embeds = routes.map((route, i) => {
                const per = { L: 0, H: 0 };
                if (plane.type === 'cargo') {
                    per.L = Math.round(Plane.largeToHeavy(route.configuration.L) / plane.capacity * 100);
                    per.H = Math.round(route.configuration.H / plane.capacity * 100);
                    const leftOver = 100 - (per.L + per.H);
                    per.L += leftOver;
                }
                const flightTime = Route.flightTime(route.distance, plane.speed).format("hh:mm:ss");
                return new MessageEmbed({
                    color: "DARK_GREEN",
                    title: `${route.arrival.city.capitalize()}, ${route.arrival.country.capitalize()} (${route.arrival.icao.toUpperCase()}/${route.arrival.iata.toUpperCase()})`,
                    description: `**Class priority:** ${formatSeats(route.preference.join(' > '))}`,
                    footer: {
                        text: `Route ${i + 1} of ${routes.length}`,
                        iconURL: interaction.client.user.displayAvatarURL()
                    },
                    thumbnail: {
                        url: `attachment://${image.name}`
                    },
                    fields: [
                        { 
                            name: Formatters.bold(Formatters.underscore("Route information")), 
                            value: `**Departure:** ${departure.city.capitalize()}, ${departure.country.capitalize()} (${formatCode(departure, user.options.code)})${route.stopover ? `\n**Stopover:** ${route.stopover.city.capitalize()}, ${route.stopover.country.capitalize()} (${formatCode(route.stopover, user.options.code)})\n` : "\n"}**Arrival:** ${route.arrival.city.capitalize()}, ${route.arrival.country.capitalize()} (${formatCode(route.arrival, user.options.code)})\n**Distance:** ${route.distance.toLocaleString(locale)}km\n**Market:** ${route.arrival.market}%\n**Runway:** ${route.arrival.runway.toLocaleString(locale)} ft\n**Flight time:** ${flightTime}\n**Flights:** ${flights}/day`, 
                            inline: false 
                        },
                        { 
                            name: Formatters.bold(Formatters.underscore("Route demand")), 
                            value: `${Formatters.formatEmoji(emojis.first_seat)} ${route.demand.F.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.business_seat)} ${route.demand.J.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.economy_seat)} ${route.demand.Y.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.large_load)} ${route.demand.L.toLocaleString(locale)} lbs\n${Formatters.formatEmoji(emojis.heavy_load)} ${route.demand.H.toLocaleString(locale)} lbs`, 
                            inline: true 
                        },
                        { 
                            name: Formatters.bold(Formatters.underscore("Ticket prices")), 
                            value: `${Formatters.formatEmoji(emojis.first_seat)} $${route.ticket[user.mode].F}\n${Formatters.formatEmoji(emojis.business_seat)} $${route.ticket[user.mode].J}\n${Formatters.formatEmoji(emojis.economy_seat)} $${route.ticket[user.mode].Y}\n${Formatters.formatEmoji(emojis.cargo_small)} $${route.ticket[user.mode].L}\n${Formatters.formatEmoji(emojis.cargo_big)} $${route.ticket[user.mode].H}`, 
                            inline: true 
                        },
                        { 
                            name: Formatters.bold(Formatters.underscore("Configuration")), 
                            value: `${Formatters.formatEmoji(emojis.first_seat)} ${route.configuration.F}\n${Formatters.formatEmoji(emojis.business_seat)} ${route.configuration.J}\n${Formatters.formatEmoji(emojis.economy_seat)} ${route.configuration.Y}\n${Formatters.formatEmoji(emojis.cargo_small)} ${per.L}%\n${Formatters.formatEmoji(emojis.cargo_big)} ${per.H}%`, 
                            inline: true 
                        },
                        { 
                            name: Formatters.bold(Formatters.underscore("Profitability")), 
                            value: `**Per flight:** $${Math.round(route.profit / flights).toLocaleString(locale)}\n**Per day:** $${Math.round(route.profit).toLocaleString(locale)}\n**Share value:** $${route.sv.toFixed(2)}/flight`, 
                            inline: false 
                        }
                    ]
                });
            });
            const pages = embeds.toGenerator();
            let currentEmbed = pages.next(1).value;
            const components = [
                new MessageActionRow({
                    components: [
                        new MessageButton({
                            style: "PRIMARY",
                            customId: "prev:10",
                            emoji: "⏪",
                            disabled: embeds.length < 10
                        }),
                        new MessageButton({
                            style: "PRIMARY",
                            customId: "prev:1",
                            emoji: "⬅️",
                            disabled: embeds.length < 2
                        }),
                        new MessageButton({
                            style: "PRIMARY",
                            customId: "next:1",
                            emoji: "➡️",
                            disabled: embeds.length < 2
                        }),
                        new MessageButton({
                            style: "PRIMARY",
                            customId: "next:10",
                            emoji: "⏩",
                            disabled: embeds.length < 10
                        })
                    ]
                }),
                new MessageActionRow({
                    components: [
                        new MessageButton({
                            customId: "plane",
                            label: "View plane",
                            style: "SECONDARY",
                            emoji: emojis.plane
                        })
                    ]
                })
            ];
            const message = await interaction.editReply({ 
                embeds: [currentEmbed], 
                files: [image],
                components 
            }) as Message;
            for (const options of followups) {
                await interaction.followUp(options)
                .catch(() => void 0);
            }
            const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000, componentType: "BUTTON" });
            collector.on("collect", async interaction => {
                if (interaction.customId === "plane") {
                    await interaction.deferReply({ ephemeral: true });
                    const embed = new MessageEmbed({
                        color: "WHITE",
                        timestamp: plane._id.getTimestamp(),
                        description: `**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`,
                        image: {
                            url: `attachment://${image.name}`
                        },
                        author: {
                            name: plane.name,
                            iconURL: plane.manufacturer.icon
                        },
                        footer: {
                            text: `engine: ${engineName || "none"}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("General statistics")), 
                                value: `**Speed:** ${Math.round(plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                inline: true 
                            },
                            { 
                                name: '\u200B', 
                                value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                inline: true 
                            }
                        ]
                    });
                    if (plane.price) {
                        const values = currentEmbed.fields[4].value.match(/[0-9,]{1,}/g);
                        const profit = parseInt(values[1].replace(/,/g, ""));
                        const profitability = Math.round(plane.price / profit);
                        const purchaseSV = Plane.estimatedShareValueFromPurchase(plane.price);
                        embed.description += `\n**Profitability:** ${profitability > 0 ? `in ${profitability.toLocaleString(locale)} days` : "never"}\n**SV from purchase:** $${purchaseSV.toFixed(2)}`;
                    }
                    await interaction.editReply({
                        embeds: [embed],
                        files: [image]
                    });
                } else {
                    const [action, value] = interaction.customId.split(":");
                    currentEmbed = pages.next(action === "prev" ? -Number(value) : Number(value)).value;
                    await interaction.update({ embeds: [currentEmbed], components });
                }
            });
            collector.once('end', async collected => {
                const reply = collected.last() || interaction;
                for (const row of components) row.components.forEach(component => component.setDisabled(true));
                await reply.editReply({ components }).catch(() => void 0);
            });
        }
        catch(error) {
            if (error instanceof DiscordClientError) {
                await error.send(interaction);
            } else {
                console.error(`Error while executing /${interaction.commandName}`, error);
                await DiscordClientError.sendUnknownError(interaction);
            }
        }
    },
    async autocomplete(interaction, { database }) {
        const focused = interaction.options.getFocused(true);
        try {
            let choices: ApplicationCommandOptionChoice[];
            if (focused.name === "plane") {
                const value = (<string>focused.value)?.slice(0, 15).match(/(\w|-|\s){1,}/g)?.join("");
                const planes = database.am4.collection<AM4_Data.plane>("Planes");
                const pipeline: Document[] = [
                    {
                        $limit: 25
                    },
                    {
                        $addFields: {
                            value: {
                                $toString: "$_id"
                            }
                        }
                    },
                    {
                        $project: {
                            _id: false,
                            name: true,
                            value: true
                        }
                    }
                ];
                if (value) {
                    pipeline.unshift({
                        $match: {
                            name: { 
                                $regex: `.*${value}.*`,
                                $options: "ix" 
                            }
                        }
                    });
                } else {
                    pipeline.unshift({
                        $sort: {
                            name: 1
                        }
                    });
                }
                const cursor = planes.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
                choices = await cursor.toArray();
            } else {
                const value = (<string>focused.value)?.slice(0, 10).match(/[a-zA-Z]/g)?.join("");
                const airports = database.am4.collection<AM4_Data.airport>("Airports");
                const query: Filter<AM4_Data.airport> = value && {
                    $or: [
                        { 
                            icao: { 
                                $regex: `.*${value.slice(0, 4)}.*`,
                                $options: "i" 
                            } 
                        },
                        { 
                            iata: { 
                                $regex: `.*${value.slice(0, 3)}.*`,
                                $options: "i" 
                            } 
                        }
                    ]
                };
                const cursor = airports.find(query, {
                    maxTimeMS: 2800,
                    limit: 25
                });
                if (!value) cursor.sort({ country: 1 });
                const results = await cursor.toArray();
                choices = results.map(airport => ({
                    name: `${airport.city.capitalize()}, ${airport.country_code.toUpperCase()} (${airport.iata.toUpperCase()}/${airport.icao.toUpperCase()})`,
                    value: airport._id.toHexString()
                }));
            }
            await interaction.respond(choices ?? [])
            .catch(() => void 0);
        }
        catch(error) {
            console.error("Error while autocompleting:", error);
            if (!interaction.responded) {
                interaction.respond([])
                .catch(() => void 0);
            };
        }
    }
}

export = command;