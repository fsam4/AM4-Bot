import { MessageEmbed, Permissions, MessageAttachment, MessageSelectMenu, MessageButton, Formatters, MessageActionRow, Constants } from 'discord.js';
import { ObjectId, type Document, type Filter } from 'mongodb';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import * as Utils from '../../utils';
import Route from '../../../src/classes/route';
import Plane from '../../../src/lib/plane';

import type { MessageComponentInteraction, Message, MessagePayload, InteractionReplyOptions, ApplicationCommandOptionChoice } from 'discord.js';
import type { Settings, AM4_Data } from '@typings/database';
import type { SlashCommand } from '../types';

const { createAirportFilter, createPlaneFilter } = Utils.MongoDB;
const { formatCode, formatSeats } = Utils.Discord;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isPublic: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.ATTACH_FILES
    ]),
    data: {
        name: 'route',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Search and compare routes",
        defaultPermission: true,
        options: [
            {
                name: 'compare',
                description: 'Returns charts that compare the specified destinations',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'departure',
                        description: 'The ICAO/IATA or ID of the departure airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'arrival_1',
                        description: 'The ICAO/IATA or ID of the first arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'arrival_2',
                        description: 'The ICAO/IATA or ID of the second arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'arrival_3',
                        description: 'The ICAO/IATA or ID of the third arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'arrival_4',
                        description: 'The ICAO/IATA or ID of the fourth arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'arrival_5',
                        description: 'The ICAO/IATA or ID of the fifth arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'plane',
                        description: 'The plane to use on these routes, if not specified profit comparison will not be returned.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: 'Your game mode if you have not saved it',
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
                    }
                ]
            },
            {
                name: 'research',
                description: 'Search for routes with the AM4 route searching tool',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'departure',
                        description: 'The ICAO/IATA code or ID of the departure airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'max_distance',
                        description: 'The maximum distance of the routes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: true
                    },
                    {
                        name: 'min_runway',
                        description: 'The minimum runway length of the routes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: 'Your game mode if you have not saved your airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: 'Realism',
                                value: 'realism'
                            },
                            {
                                name: 'Easy',
                                value: 'easy'
                            }
                        ]
                    }
                ]
            },
            {
                name: 'search',
                description: 'Search for a certain route and stopover if needed',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'departure',
                        description: 'The ICAO/IATA or ID of the departure airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'arrival',
                        description: 'The ICAO/IATA or ID of the arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'stopover',
                        description: 'The stopover for this route. If required, but not defined, the bot will find the best possible stopover.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'plane',
                        description: 'The plane to use on this route',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'flights',
                        description: 'Filter routes by amount of flights/day',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
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
                        description: 'Your game mode if you have not saved it',
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
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, rest, ephemeral, locale }) {
        await interaction.deferReply({ ephemeral });
        const settings = database.settings.collection<Settings.user>('Users')
        const planeSettings = database.settings.collection<Settings.plane>('Planes');
        const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
        const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
        const user = new Utils.User(interaction.user.id, await settings.findOne({ id: interaction.user.id }));
        try {
            const subCommand = interaction.options.getSubcommand();
            type GameMode = "realism" | "easy";
            switch(subCommand) {
                case "search": {
                    const departureCode = interaction.options.getString("departure", true).trim();
                    const arrivalCode = interaction.options.getString("arrival", true).trim();
                    const stopoverCode = interaction.options.getString("stopover")?.trim();
                    const mode = interaction.options.getString("mode")?.trim();
                    type MessageResolvable = string | MessagePayload | InteractionReplyOptions;
                    const followups: MessageResolvable[] = [];
                    if (mode && mode === user.mode) followups.push({
                        content: "🪙 When you have logged in you do not need to define the game mode anymore as it will be automatically filled for you.",
                        ephemeral: true
                    });
                    if (mode) user.mode = <GameMode>mode;
                    if (!user.mode) throw new DiscordClientError('You need to define the game mode or save it by logging in with `/user login`...');
                    const departure = await airportCollection.findOne(createAirportFilter(departureCode));
                    if (!departure) throw new DiscordClientError('That is not a valid departure airport...');
                    const arrival = await airportCollection.findOne(createAirportFilter(arrivalCode));
                    if (!arrival) throw new DiscordClientError('That is not a valid arrival airport...');
                    const { status, route, demand, ticket } = await rest.fetchRoute('demand', {
                        dep_icao: departure.icao,
                        arr_icao: arrival.icao
                    });
                    if (!status.success) throw new DiscordClientError(status.error);
                    const embed = new MessageEmbed({
                        title: `${formatCode(departure, user.options.code)} to ${formatCode(arrival, user.options.code)}`,
                        color: "DARK_GREEN",
                        footer: {
                            text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("Route demand")), 
                                value: `<:first_seat:836890797495812117> ${demand.F.toLocaleString(locale)}\n<:business_seat:836890763664818207> ${demand.J.toLocaleString(locale)}\n<:economy_seat:836890782606557185> ${demand.Y.toLocaleString(locale)}\n<:cargo_small:836889344844365844> ${demand.L.toLocaleString(locale)} lbs\n<:cargo_big:836889319939244043> ${demand.H.toLocaleString(locale)} lbs`, 
                                inline: true 
                            } 
                        ]
                    });
                    let plane: AM4_Data.plane, engineName: string, profit: number;
                    const planeName = interaction.options.getString("plane")?.trim();
                    const row = new MessageActionRow();
                    const files: MessageAttachment[] = [];
                    if (planeName) {
                        plane = await planeCollection.findOne(createPlaneFilter(planeName));
                        if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
                        let flights = interaction.options.getInteger("flights");
                        const reputation = interaction.options.getInteger("reputation");
                        const cost_index = interaction.options.getInteger("cost_index") ?? user.options.cost_index
                        const change = (100 + (100 - reputation)) / 100;
                        const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                        embed.setThumbnail(`attachment://${image.name}`);
                        files.push(image);
                        const plane_settings = await planeSettings.findOne({ 
                            planeID: plane._id, 
                            id: interaction.user.id 
                        });
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
                                content: "🪙 You can configure settings for this plane via `/plane settings`. Configuring settings for planes is recommended as on default they use market statistics.",
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
                        if (stopoverCode) {
                            const stopover = await airportCollection.findOne(createAirportFilter(stopoverCode));
                            const locations = [departure, stopover, arrival].map(airport => ({
                                longitude: airport.location.coordinates[0],
                                latitude: airport.location.coordinates[1]
                            }));
                            const { distance, distances } = Route.distance(...locations);
                            if (!flights) flights = Route.flights(distance, plane.speed, user.options.activity);
                            const { configuration, preference } = Route.configure(plane, {
                                options: {
                                    preference: user.preference[plane.type === "cargo" ? "cargo" : "pax"],
                                    mode: user.mode,
                                    flights: flights,
                                    reputation: reputation || 100,
                                    activity: user.options.activity
                                },
                                route: {
                                    demand: demand, 
                                    distance: distance
                                }
                            });
                            const cargoConfig = {
                                L: plane.type === 'pax' ? 0 : Math.round(Math.percentage(Plane.largeToHeavy(configuration.L), plane.capacity)),
                                H: plane.type === 'pax' ? 0 : Math.round(Math.percentage(configuration.H, plane.capacity))
                            };
                            if (plane.type === 'cargo') {
                                const leftOver = 100 - (cargoConfig.L + cargoConfig.H);
                                cargoConfig.L += leftOver;
                            }
                            const options = {
                                options: {
                                    activity: user.options.activity,
                                    fuel_price: user.options.fuel_price,
                                    co2_price: user.options.co2_price,
                                    reputation: reputation || 100,
                                    mode: user.mode
                                },
                                route: {
                                    distance, 
                                    configuration, 
                                    flights
                                }
                            };
                            profit = Route.profit(plane, options).profit;
                            embed.setDescription(`**Class priority:** ${formatSeats(preference.join(' > '))}`);
                            if (plane.type === 'pax' && configuration[preference[2]] * flights > demand[preference[2]] * change && user.options.show_warnings) {
                                followups.push({
                                    content: '⚠️ The demand of this route might not be able to support this plane!',
                                    ephemeral: true
                                });
                            } else if (plane.type === 'cargo' && configuration[preference[1]] * flights > demand[preference[1]] * change && user.options.show_warnings) {
                                followups.push({
                                    content: '⚠️ The demand of this route might not be able to support this plane!',
                                    ephemeral: true
                                });
                            }
                            if (!distances.every(distance => distance <= plane.range) && user.options.show_warnings) {
                                followups.push({
                                    content: `⚠️ The range of the plane is ${Formatters.bold(`${Math.round(plane.range).toLocaleString(locale)} km`)} and the longest leg on this route is ${Formatters.bold(`${route.distance.toLocaleString(locale)} km`)}!`,
                                    ephemeral: true
                                });
                            }
                            if ((plane.runway > arrival.runway) || (plane.runway > stopover.runway) && user.mode === 'realism' && user.options.show_warnings) {
                                followups.push({
                                    content: `⚠️ The runway requirement of this plane is ${Formatters.bold(`${plane.runway.toLocaleString(locale)} ft`)} and the runway of the destination/stopover is ${Formatters.bold(`${arrival.runway.toLocaleString(locale)} ft`)}!`,
                                    ephemeral: true
                                });
                            }
                            const ticketType = plane.type === "vip" ? "vip" : "default";
                            const estimatedSV = Route.estimatedShareValueGrowth(plane, options) / flights;
                            embed.addFields([
                                { 
                                    name: Formatters.bold(Formatters.underscore("Route information")), 
                                    value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Stopover:** ${stopover.city.capitalize()}, ${stopover.country.capitalize()} (${formatCode(stopover, user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)})\n**Distance:** ${distance.toLocaleString(locale)}km\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Flight time:** ${Route.flightTime(route.distance, plane.speed).format("hh:mm:ss")}\n**Flights:** ${flights.toLocaleString(locale)}/day`, 
                                    inline: false 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Ticket prices")), 
                                    value: `<:first_seat:836890797495812117> $${ticket[user.mode][ticketType].F}\n<:business_seat:836890763664818207> $${ticket[user.mode][ticketType].J}\n<:economy_seat:836890782606557185> $${ticket[user.mode][ticketType].Y}\n<:cargo_small:836889344844365844> $${ticket[user.mode].default.L}\n<:cargo_big:836889319939244043> $${ticket[user.mode].default.H}`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Configuration")), 
                                    value: `<:first_seat:836890797495812117> ${configuration.F}\n<:business_seat:836890763664818207> ${configuration.J}\n<:economy_seat:836890782606557185> ${configuration.Y}\n<:cargo_small:836889344844365844> ${cargoConfig.L}%\n<:cargo_big:836889319939244043> ${cargoConfig.H}%`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profitability")), 
                                    value: `**Per flight:** $${Math.round(profit / flights).toLocaleString(locale)}\n**Per day:** $${Math.round(profit).toLocaleString(locale)}\n**Share value:** $${estimatedSV.toFixed(2)}/flight`, 
                                    inline: false 
                                }
                            ]);
                        } else {
                            if (!flights) flights = Route.flights(route.distance, plane.speed, user.options.activity);
                            const { configuration, preference } = Route.configure(plane, {
                                options: {
                                    preference: user.preference[plane.type === "cargo" ? "cargo" : "pax"],
                                    mode: user.mode,
                                    flights: flights,
                                    reputation: reputation || 100,
                                    activity: user.options.activity
                                },
                                route: {
                                    demand: demand, 
                                    distance: route.distance
                                }
                            });
                            const cargoConfig = {
                                L: plane.type === 'pax' ? 0 : Math.round(Math.percentage(Plane.largeToHeavy(configuration.L), plane.capacity)),
                                H: plane.type === 'pax' ? 0 : Math.round(Math.percentage(configuration.H, plane.capacity))
                            };
                            if (plane.type === 'cargo') {
                                const leftOver = 100 - (cargoConfig.L + cargoConfig.H);
                                cargoConfig.L += leftOver;
                            }
                            const options = {
                                options: {
                                    activity: user.options.activity,
                                    fuel_price: user.options.fuel_price,
                                    co2_price: user.options.co2_price,
                                    reputation: reputation || 100,
                                    mode: user.mode
                                },
                                route: {
                                    distance: route.distance, 
                                    configuration, flights
                                }
                            };
                            profit = Route.profit(plane, options).profit;
                            embed.setDescription(`**Class priority:** ${formatSeats(preference.join(' > '))}`);
                            if (plane.type === 'pax' && configuration[preference[2]] * flights > demand[preference[2]] * change && user.options.show_warnings) {
                                followups.push({
                                    content: '⚠️ The demand of this route might not be able to support this plane!',
                                    ephemeral: true
                                });
                            } else if (plane.type === 'cargo' && configuration[preference[1]] * flights > demand[preference[1]] * change && user.options.show_warnings) {
                                followups.push({
                                    content: '⚠️ The demand of this route might not be able to support this plane!',
                                    ephemeral: true
                                });
                            }
                            if (route.distance > plane.range * 2 && user.options.show_warnings) {
                                followups.push({
                                    content: `⚠️ The maximum distance of this plane with a stopover is ${Formatters.bold(`${Math.round(plane.range * 2).toLocaleString(locale)} km`)} and the distance of this route is ${Formatters.bold(`${route.distance.toLocaleString(locale)} km`)}!`,
                                    ephemeral: true
                                });
                            }
                            if (plane.runway > arrival.runway && user.mode === 'realism' && user.options.show_warnings) {
                                followups.push({
                                    content: `⚠️ The runway requirement of this plane is ${Formatters.bold(`${plane.runway.toLocaleString(locale)} ft`)} and the runway of the destination is ${Formatters.bold(`${arrival.runway.toLocaleString(locale)} ft`)}!`,
                                    ephemeral: true
                                });
                            }
                            const ticketType = plane.type === "vip" ? "vip" : "default";
                            const estimatedSV = Route.estimatedShareValueGrowth(plane, options) / flights;
                            embed.addFields([
                                { 
                                    name: Formatters.bold(Formatters.underscore("Ticket prices")), 
                                    value: `<:first_seat:836890797495812117> $${ticket[user.mode][ticketType].F}\n<:business_seat:836890763664818207> $${ticket[user.mode][ticketType].J}\n<:economy_seat:836890782606557185> $${ticket[user.mode][ticketType].Y}\n<:cargo_small:836889344844365844> $${ticket[user.mode].default.L}\n<:cargo_big:836889319939244043> $${ticket[user.mode].default.H}`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Configuration")), 
                                    value: `<:first_seat:836890797495812117> ${configuration.F}\n<:business_seat:836890763664818207> ${configuration.J}\n<:economy_seat:836890782606557185> ${configuration.Y}\n<:cargo_small:836889344844365844> ${cargoConfig.L}%\n<:cargo_big:836889319939244043> ${cargoConfig.H}%`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profitability")), 
                                    value: `**Per flight:** $${Math.round(profit / flights).toLocaleString(locale)}\n**Per day:** $${Math.round(profit).toLocaleString(locale)}\n**Share value:** $${estimatedSV.toFixed(2)}/flight`, 
                                    inline: false 
                                }
                            ]);
                            if (route.distance > plane.range) {
                                if (plane.type === "vip") throw new DiscordClientError("Currently it is not possible to fetch a stopover for a VIP plane...");
                                const { status, stopover } = await route.stopover(plane.name, plane.type);
                                if (!status.success) followups.push('**Warning:** no suitable stopover could be found for this route!');
                                if (status.success && typeof stopover[user.mode] !== 'string') {
                                    embed.fields.unshift({ 
                                        name: Formatters.bold(Formatters.underscore("Route information")), 
                                        // @ts-expect-error: stopover type is always correct at runtime
                                        value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Stopover:** ${stopover[user.mode].city}, ${stopover[user.mode].country} (${formatCode(stopover[user.mode], user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)}\n**Distance:** ${route.distance.toLocaleString(locale)}km (+${stopover[user.mode].difference.toFixed(3)}km)\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Flight time:** ${Route.flightTime(route.distance, plane.speed).format("hh:mm:ss")}\n**Flights:** ${flights}/day`, 
                                        inline: false 
                                    });
                                } else {
                                    embed.fields.unshift({ 
                                        name: Formatters.bold(Formatters.underscore("Route information")), 
                                        value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)})\n**Distance:** ${route.distance.toLocaleString(locale)}km\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Flight time:** ${Route.flightTime(route.distance, plane.speed).format("hh:mm:ss")}\n**Flights:** ${flights}/day`, 
                                        inline: false 
                                    });
                                }
                            } else {
                                embed.fields.unshift({ 
                                    name: Formatters.bold(Formatters.underscore("Route information")), 
                                    value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)})\n**Distance:** ${route.distance.toLocaleString(locale)}km\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Flight time:** ${Route.flightTime(route.distance, plane.speed).format("hh:mm:ss")}\n**Flights:** ${flights}/day`, 
                                    inline: false 
                                });
                            }  
                        }
                        row.addComponents([
                            new MessageButton({
                                customId: "plane",
                                label: "View plane",
                                style: "SECONDARY",
                                emoji: "836889841517330442"
                            })
                        ]);
                    } else {
                        if (stopoverCode) {
                            const stopover = await airportCollection.findOne(createAirportFilter(stopoverCode));
                            const locations = [departure, stopover, arrival].map(airport => ({
                                longitude: airport.location.coordinates[0],
                                latitude: airport.location.coordinates[1]
                            }));
                            const { distance } = Route.distance(...locations);
                            embed.fields.unshift({ 
                                name: Formatters.bold(Formatters.underscore("Route information")), 
                                value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Stopover:** ${stopover.city.capitalize()}, ${stopover.country.capitalize()} (${formatCode(stopover, user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)})\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Distance:** ${distance.toLocaleString(locale)}km`, 
                                inline: false 
                            });
                        } else {
                            embed.fields.unshift({ 
                                name: Formatters.bold(Formatters.underscore("Route information")), 
                                value: `**Departure:** ${route.departure.airport} (${formatCode(departure, user.options.code)})\n**Arrival:** ${route.arrival.airport} (${formatCode(arrival, user.options.code)})\n**Market:** ${arrival.market}%\n**Runway:** ${arrival.runway.toLocaleString(locale)} ft\n**Distance:** ${route.distance.toLocaleString(locale)}km`, 
                                inline: false 
                            });
                        }
                        embed.addFields({ 
                            name: Formatters.bold(Formatters.underscore("Ticket prices")), 
                            value: `<:first_seat:836890797495812117> $${ticket[user.mode].default.F}\n<:business_seat:836890763664818207> $${ticket[user.mode].default.J}\n<:economy_seat:836890782606557185> $${ticket[user.mode].default.Y}\n<:cargo_small:836889344844365844> $${ticket[user.mode].default.L}\n<:cargo_big:836889319939244043> $${ticket[user.mode].default.H}`, 
                            inline: true 
                        });
                        row.addComponents([
                            new MessageButton({
                                customId: "vip",
                                label: "Use VIP ticket prices",
                                style: "PRIMARY",
                                emoji: "875394473172033546"
                            })
                        ]);
                    }
                    const reply = await interaction.editReply({
                        embeds: [embed],
                        components: [row],
                        files: files
                    }) as Message;
                    for (const options of followups) {
                        await interaction.followUp(options)
                        .catch(err => void err);
                    }
                    const filter = ({ user, customId }: MessageComponentInteraction) => customId === "plane" || user.id === interaction.user.id;
                    const collector = reply.createMessageComponentCollector({ filter, time: 10 * 60 * 1000 });
                    collector.on("collect", async interaction => {
                        if (interaction.isButton()) {
                            const button = <MessageButton>interaction.component;
                            if (interaction.customId === "plane") {
                                if (!plane) return interaction.reply("Something went wrong with displaying this plane...");
                                await interaction.deferReply({ ephemeral: true });
                                const embed = new MessageEmbed({
                                    color: "WHITE",
                                    timestamp: plane._id.getTimestamp(),
                                    description: `**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`,
                                    image: {
                                        url: `attachment://${files[0].name}`
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
                                            value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} <:points:836889858545811496>`}\n**A-check:** $${Math.round(plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                            inline: true 
                                        }
                                    ]
                                });
                                if (plane.price) {
                                    const profitability = Math.round(plane.price / profit);
                                    const purchaseSV = Plane.estimatedShareValueFromPurchase(plane.price);
                                    embed.description += `\n**Profitability:** ${profitability > 0 ? `in ${profitability.toLocaleString(locale)} days` : "never"}\n**SV from purchase:** $${purchaseSV.toFixed(2)}`;
                                }
                                await interaction.editReply({
                                    embeds: [embed],
                                    files: files
                                });
                            } else {
                                embed.fields.last().value = `<:first_seat:836890797495812117> $${ticket[user.mode][interaction.customId].F}\n<:business_seat:836890763664818207> $${ticket[user.mode][interaction.customId].J}\n<:economy_seat:836890782606557185> $${ticket[user.mode][interaction.customId].Y}\n<:cargo_small:836889344844365844> $${ticket[user.mode][interaction.customId].L}\n<:cargo_big:836889319939244043> $${ticket[user.mode].default.H}`;
                                button.setCustomId(interaction.customId === "vip" ? "default" : "vip");
                                button.setLabel(interaction.customId === "vip" ? "Use default ticket prices" : "Use VIP ticket prices");
                                button.setEmoji(interaction.customId === "vip" ? "875394515006005309" : "875394473172033546");
                                row.components[0] = button;
                                await interaction.update({
                                    embeds: [embed],
                                    components: [row]
                                });
                                if (interaction.customId === "vip" && user.options.show_warnings) await interaction.followUp({
                                    content: "⚠️ The VIP ticket prices are still experimental. Use them at your own risk!",
                                    ephemeral: true
                                });
                            }
                        }
                    });
                    collector.once("end", async collected => {
                        row.components.forEach(component => component.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(err => void err);
                    });
                    break;
                }
                case "research": {
                    const mode = interaction.options.getString("mode")?.trim();
                    if (mode) user.mode = <GameMode>mode;
                    if (!user.mode) throw new DiscordClientError('You need to define the game mode or save it by logging in with `/user login`...');
                    const departure_code = interaction.options.getString("departure", true).trim();
                    const dep_airport = await airportCollection.findOne(createAirportFilter(departure_code));
                    if (!dep_airport) throw new DiscordClientError('That is not a valid departure airport...');
                    const { status, routes } = await rest.fetchRoute('research', {
                        dep_icao: dep_airport.icao,
                        min_runway: interaction.options.getInteger("min_runway") || 0,
                        max_distance: interaction.options.getInteger("max_distance", true)
                    });
                    if (!status.success) throw new DiscordClientError(status.error);
                    const embeds = routes.map(({ route, demand, ticket }) => new MessageEmbed({
                        color: "DARK_GREEN",
                        title: route.arrival,
                        footer: {
                            text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("Route information")), 
                                value: `**Departure:** ${route.departure}\n**Arrival:** ${route.arrival} (${formatCode(route, user.options.code)})\n**Market:** ${route.market}%\n**Runway:** ${route.runway.toLocaleString(locale)} ft\n**Distance:** ${route.distance.toLocaleString(locale)}km`, 
                                inline: false 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Route demand")), 
                                value: `<:first_seat:836890797495812117> ${demand.F.toLocaleString(locale)}\n<:business_seat:836890763664818207> ${demand.J.toLocaleString(locale)}\n<:economy_seat:836890782606557185> ${demand.Y.toLocaleString(locale)}\n<:cargo_small:836889344844365844> ${demand.L.toLocaleString(locale)} lbs\n<:cargo_big:836889319939244043> ${demand.H.toLocaleString(locale)} lbs`, 
                                inline: true 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Ticket prices")), 
                                value: `<:first_seat:836890797495812117> $${ticket[user.mode].default.F}\n<:business_seat:836890763664818207> $${ticket[user.mode].default.J}\n<:economy_seat:836890782606557185> $${ticket[user.mode].default.Y}\n<:cargo_small:836889344844365844> $${ticket[user.mode].default.L}\n<:cargo_big:836889319939244043> $${ticket[user.mode].default.H}`, 
                                inline: true 
                            }
                        ]
                    }));
                    const select = new MessageSelectMenu({
                        customId: "route",
                        placeholder: "Select a route...",
                        options: routes.map(({ route }, i) => ({
                            label: formatCode(route, user.options.code),
                            value: i.toString(),
                            description: route.arrival,
                            default: !i
                        }))
                    });
                    const row = new MessageActionRow({ components: [select] });
                    const message = await interaction.editReply({ 
                        embeds: [embeds[0]], 
                        components: [row] 
                    }) as Message;
                    const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                    const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                    collector.on("collect", async interaction => {
                        if (interaction.isSelectMenu()) {
                            const [index] = interaction.values;
                            for (const option of select.options) option.default = option.value === index;
                            row.setComponents(select);
                            await interaction.update({
                                embeds: [embeds[index]],
                                components: [row]
                            });
                        }
                    });
                    collector.once('end', async collected => {
                        row.setComponents(select.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(err => void err);
                    });
                    break;
                }
                case "compare": {
                    const departure_code = interaction.options.getString("departure", true).trim();
                    const departure = await airportCollection.findOne(createAirportFilter(departure_code));
                    if (!departure) throw new DiscordClientError("Invalid departure airport");
                    let destinations = interaction.options.data[0].options.filter(option => option.name.startsWith("route"));
                    const routes = await Promise.all<Route>(
                        destinations.map(async a => {
                            const code = (<string>a.value).trim();
                            const arrival = await airportCollection.findOne(createAirportFilter(code));
                            if (!arrival) throw new DiscordClientError(`${Formatters.bold(`${a.name}:`)} Unknown airport`);
                            const response = await rest.fetchRoute('demand', {
                                dep_icao: departure.icao,
                                arr_icao: arrival.icao
                            });
                            if (!response.status.success) throw new DiscordClientError(`${Formatters.bold(`${a.name}:`)} ${response.status.error}`);
                            return response;
                        })
                    );
    
                    const graphs: Array<{ [key: string]: any }> = [
                        {
                            id: new ObjectId(),
                            type: "Radar graph",
                            description: "Radar graph comparing the demand of the routes. Large and heavy demands are displayed in thousands.",
                            data: {
                                type: "radar",
                                data: {
                                    labels: [
                                        'Economy class',
                                        'Business class',
                                        'First class',
                                        'Heavy load (k)',
                                        'Large load (k)'
                                    ],
                                    datasets: routes.map(({ demand, route }) => ({
                                        label: route.arrival.airport,
                                        data: [ 
                                            demand.Y, 
                                            demand.J, 
                                            demand.F, 
                                            demand.H / 1000, 
                                            demand.L / 1000 
                                        ]
                                    }))
                                },
                                options: {
                                    title: {
                                        position: 'left',
                                        display: true,
                                        text: 'Route Demand',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
                                        }
                                    },
                                    maintainAspectRatio: true,
                                    spanGaps: false,
                                    elements: {
                                        line: {
                                            tension: 0.000001
                                        }
                                    },
                                    plugins: {
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        },
                                        filler: {
                                            propagate: false
                                        },
                                        "samples-filler-analyser": {
                                            target: "chart-analyser"
                                        }
                                    },
                                    scale: {
                                        pointLabels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
                                        },
                                        gridLines: {
                                            drawBorder: true,
                                            color: 'gray'
                                        },
                                        angleLines: {
                                            color: 'gray'
                                        }
                                    }
                                }
                            }
                        },
                        {
                            id: new ObjectId(),
                            type: "Horizontal bar graph",
                            description: "Horizontal bar graph comparing the distance of the routes.",
                            data: {
                                type: 'horizontalBar',
                                data: {
                                    labels: routes.map(({ route }) => route.arrival.airport),
                                    datasets: [
                                        {
                                            label: 'Distance',
                                            borderWidth: 1,
                                            data: routes.map(({ route }) => route.distance) 
                                        }
                                    ]
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Route Distance',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    plugins: {
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        }
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                            display: true
                                        }
                                    },
                                    scales: {
                                        yAxes: [
                                            {
                                                type: 'category',
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white'
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    callback: (val: number) => `${val.toLocaleString('en')} km`
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    ];
                    const planeName = interaction.options.getString("plane")?.trim();
                    if (planeName) {
                        const mode = interaction.options.getString("mode")?.trim();
                        if (mode) user.mode = <GameMode>mode;
                        if (!user.mode) throw new DiscordClientError('You need to either define your game mode in arguments or save it by logging in with `/user login`!');
                        const plane = await planeCollection.findOne(createPlaneFilter(planeName));
                        if (!plane) throw new DiscordClientError(`No plane could be found with ${Formatters.bold(planeName)}...`);
                        const plane_settings = await planeSettings.findOne({  
                            id: interaction.user.id,
                            planeID: plane._id
                        });
                        if (plane_settings) {
                            if (plane_settings.engine) {
                                const engine = plane.engines.find(engine => engine.name === plane_settings.engine);
                                plane.speed = engine.speed;
                                plane.fuel = engine.fuel;
                            }
                            const modifications = plane_settings.modifications;
                            if (modifications.speed) plane.speed *= 1.1;
                            if (modifications.fuel) plane.fuel *= 0.9;
                            if (modifications.co2) plane.co2 *= 0.9;
                        }
                        if (user.mode === 'realism') plane.A_check.price *= 2;
                        if (user.mode === 'easy') plane.speed *= 1.5;
                        plane.fuel *= (100 - user.training.fuel) / 100;
                        plane.co2 *= (100 - user.training.co2) / 100;
                        graphs.push({
                            id: new ObjectId(),
                            type: "Bar graph",
                            description: "Bar graph comparing the expenses, income and final profit of the route.",
                            data: {
                                type: 'bar',
                                data: {
                                    labels: [ 'Profit', 'Expenses', 'Income' ],
                                    datasets: routes.map(({ route, demand }) => {
                                        let flights = Route.flights(route.distance, plane.speed, user.options.activity);
                                        const { configuration } = Route.configure(plane, {
                                            options: {
                                                preference: user.preference[plane.type === "cargo" ? "cargo" : "pax"],
                                                mode: user.mode,
                                                flights: flights,
                                                reputation: 100,
                                                activity: user.options.activity
                                            },
                                            route: {
                                                demand: demand, 
                                                distance: route.distance
                                            }
                                        });
                                        const { profit, expenses, income } = Route.profit(plane, {
                                            options: {
                                                activity: user.options.activity,
                                                fuel_price: user.options.fuel_price,
                                                co2_price: user.options.co2_price,
                                                reputation: 100,
                                                mode: user.mode 
                                            },
                                            route: {
                                                distance: route.distance, 
                                                configuration, flights
                                            }
                                        });
                                        return {
                                            label: route.arrival.airport,
                                            data: [ profit, expenses, income ],
                                            borderWidth: 1,
                                        }
                                    })
                                },
                                options: {
                                    plugins: {
                                        tickFormat: {
                                            style: 'currency',
                                            currency: 'USD',
                                            minimumFractionDigits: 0
                                        },
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Route Profitability',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        }
                                    },
                                    scales: {
                                        yAxes: [
                                            {
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white'
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                gridLines: {
                                                    display: false
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        });
                        const select = new MessageSelectMenu({ 
                            customId: "chart", 
                            placeholder: "Select a graph...",
                            maxValues: 1,
                            minValues: 1,
                            options: graphs.map((graph, index) => ({
                                label: graph.data.options.title.text,
                                description: graph.type,
                                value: graph.id.toHexString(),
                                default: !index
                            }))
                        });
                        const chart = new QuickChart()
                        .setConfig(graphs[0].data)
                        .setBackgroundColor("transparent");
                        const embed = new MessageEmbed({
                            color: 15105570,
                            title: "Route comparing",
                            description: graphs[0].description,
                            image: {
                                url: await chart.getShortUrl()
                            },
                            footer: {
                                text: `Requests remaining: ${routes.last().status.requestsRemaining.toLocaleString(locale)}`,
                                iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                            }
                        });
                        const row = new MessageActionRow({ components: [select] });
                        const message = await interaction.editReply({ 
                            embeds: [embed], 
                            components: [row] 
                        }) as Message;
                        const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                        const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                        collector.on("collect", async interaction => {
                            if (interaction.isSelectMenu()) {
                                const value = interaction.values[0];
                                const graph = graphs.find(graph => graph.id.equals(value));
                                embed.setDescription(graph.description);
                                const chart = new QuickChart()
                                .setConfig(graph.data)
                                .setBackgroundColor("transparent");
                                const url = await chart.getShortUrl();
                                for (const option of select.options) option.default = (value === option.value);
                                row.setComponents(select);
                                await interaction.update({ 
                                    embeds: [embed.setImage(url)],
                                    components: [row]
                                });
                            }
                        });
                        collector.once("end", async collected => {
                            row.setComponents(select.setDisabled(true));
                            const reply = collected.last() || interaction;
                            await reply.editReply({ components: [row] }).catch(err => void err);
                        });
                        break;
                    }
                    break;
                }
            }
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
            .catch(err => void err);
        }
        catch(error) {
            console.error("Error while autocompleting:", error);
            if (!interaction.responded) {
                interaction.respond([])
                .catch(err => void err);
            };
        }
    }
}

export = command;