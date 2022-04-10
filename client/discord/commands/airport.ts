import { MessageEmbed, Permissions, MessageAttachment, MessageActionRow, MessageButton, MessageSelectMenu, Formatters, Constants, type ApplicationCommandOptionChoice } from 'discord.js';
import { ObjectId, type Filter, type Document } from 'mongodb';
import * as Utils from '../../utils';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';
import Route from '../../../src/classes/route';
import Plane from '../../../src/lib/plane';

import type { AM4, Settings, GeoNear } from '@typings/database';
import type { SlashCommand } from '@discord/types';
import type { GameMode } from '@typings/am4-api';

interface Airport extends AM4.Airport {
    totalPax: number,
    totalCargo: number,
    average_demand: {
        Y: number,
        J: number,
        F: number,
        L: number,
        H: number
    }
}

const { createAirportFilter, createTextFilter, createLocationBox, createLocationSphere } = Utils.MongoDB;
const { formatCode, createAttachmentUrl, isCachedCommandInteraction } = Utils.Discord;

type SphereCoordinates = Parameters<typeof createLocationSphere>;
type BoxCoordinates = Parameters<typeof createLocationBox>;

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
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS
    ]),
    data: {
        name: 'airport',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Search and filter airports',
        defaultPermission: true,
        options: [
            {
                name: 'search',
                description: 'Search for an airport',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'code',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    }
                ]
            },
            {
                name: 'filter',
                description: 'Filter airports matching your criteria',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'market',
                        description: 'Minimum market (0-90) percentage.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 0,
                        maxValue: 90,
                        required: false
                    },
                    {
                        name: 'country',
                        description: 'The country name or country code of the airports.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'runway',
                        description: 'The minimum runway length (0-18045) of the airports.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 0,
                        maxValue: 18045,
                        required: false
                    },
                    {
                        name: 'limit',
                        description: 'The maximum amount (10-1000) of airports to return. By default 1000.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 10,
                        maxValue: 1000,
                        required: false
                    }
                ]
            },
            {
                name: 'sell_plane',
                description: 'Find the best airport to sell a plane',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'hub',
                        description: 'The ICAO/IATA code of the hub where the plane is in.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'plane',
                        description: 'The plane that you want to sell.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'market',
                        description: 'The minimum market (0-90) percentage. By default 89.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 0,
                        maxValue: 90,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: "The game mode to use for the calculations. By default your airline's game mode.",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: "Realism",
                                value: "Realism"
                            },
                            {
                                name: "Easy",
                                value: "Easy"
                            }
                        ]
                    }
                ]
            },
            {
                name: 'stopovers',
                description: 'Find best stopover airports between two airports',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'departure',
                        description: 'The departure airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'arrival',
                        description: 'The arrival airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'plane',
                        description: 'The plane to use between the two airports',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'amount',
                        description: 'The amount of stopovers between the airports (1-3). By default 1.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        maxValue: 3,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: "The game mode to use for the calculations. By default your airline's game mode.",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: "Realism",
                                value: "Realism"
                            },
                            {
                                name: "Easy",
                                value: "Easy"
                            }
                        ]
                    }
                ]
            },
            {
                name: 'compare',
                description: 'Compare airports with graphs',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'airport_1',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'airport_2',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'airport_3',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'airport_4',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'airport_5',
                        description: 'The ICAO/IATA code of the airport',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    }
                ]
            },
            {
                name: 'geo',
                description: 'Search airports based on geographical locations',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'near',
                        description: 'Find airports near another airport',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'airport',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'min_distance',
                                description: 'The minimum distance of the airport from this airport (in kilometers).',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                required: true
                            },
                            {
                                name: 'max_distance',
                                description: 'The maximum distance of the airport from this airport (in kilometers).',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                required: true
                            },
                            {
                                name: 'limit',
                                description: 'The maximum amount (10-1000) of airports to return. By default 1000.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 10,
                                maxValue: 1000,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'box',
                        description: 'Find airports in a "box" between two airports',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'airport_1',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'airport_2',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'limit',
                                description: 'The maximum amount (10-1000) of airports to return. By default 1000.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 10,
                                maxValue: 1000,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'polygon',
                        description: 'Find airports that are within the bounds of a polygon formed by specified airports',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'airport_1',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'airport_2',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'airport_3',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'airport_4',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: false
                            },
                            {
                                name: 'airport_5',
                                description: 'The ICAO/IATA code of the airport',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: false
                            },
                            {
                                name: 'limit',
                                description: 'The maximum amount (10-1000) of airports to return. By default 1000.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 10,
                                maxValue: 1000,
                                required: false
                            }
                        ]
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, client, ephemeral, locale }) {
        await interaction.deferReply({ ephemeral });
        try {
            const airportCollection = database.am4.collection<AM4.Airport>('Airports');
            const routeCollection = database.am4.collection<AM4.Route>('Routes');
            const planeCollection = database.am4.collection<AM4.Plane>('Planes');
            const userCollection = database.settings.collection<Settings.User>('Users');
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "search": {
                    const input = interaction.options.getString("code").trim();
                    const airport = await airportCollection.findOne(createAirportFilter(input));
                    const routes = await routeCollection.find({ airports: airport._id }).toArray();
                    const average = {
                        Y: Math.round(routes.map(route => route.demand.Y).reduce((a, b) => a + b) / routes.length),
                        J: Math.round(routes.map(route => route.demand.J).reduce((a, b) => a + b) / routes.length),
                        F: Math.round(routes.map(route => route.demand.F).reduce((a, b) => a + b) / routes.length),
                        L: Math.round(routes.map(route => route.demand.L).reduce((a, b) => a + b) / routes.length),
                        H: Math.round(routes.map(route => route.demand.H).reduce((a, b) => a + b) / routes.length)
                    }
                    if (!airport) throw new DiscordClientError("Unknown airport");
                    const embed = new MessageEmbed({
                        color: "BLUE",
                        title: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()}`,
                        thumbnail: {
                            url: "https://i.ibb.co/rpHM4Jm/hq.png"
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("Information")), 
                                value: `**City:** ${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}\n**Country:** ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.country_code.toUpperCase()})\n**ICAO:** ${airport.icao.toUpperCase()}\n**IATA:** ${airport.iata.toUpperCase()}` 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Statistics")), 
                                value: `**Market:** ${airport.market}%\n**Runway:** ${airport.runway.toLocaleString(locale)} ft\n**Routes:** ${routes.length.toLocaleString(locale)}` 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Average demand")), 
                                value: `${Formatters.formatEmoji(emojis.first_seat)} ${average.F.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.business_seat)} ${average.J.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.economy_seat)} ${average.Y.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.large_load)} ${average.L.toLocaleString(locale)} lbs\n${Formatters.formatEmoji(emojis.heavy_load)} ${average.H.toLocaleString(locale)} lbs` 
                            }
                        ]
                    });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case "filter": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const market = interaction.options.getInteger("market");
                    const runway = interaction.options.getInteger("runway");
                    const country = interaction.options.getString("country")?.trimEnd();
                    const limit = interaction.options.getInteger("limit") || 1000;
                    let query: Filter<AM4.Airport> = {};
                    if (market) query.market = { $gte: market };
                    if (runway) query.runway = { $gte: runway };
                    if (country) query = {
                        ...query,
                        $or: [
                            { country_code: country.toLowerCase() },
                            { country: country.toLowerCase() },
                        ]
                    };
                    const cursor = airportCollection.find(query);
                    const amount = await cursor.count();
                    if (!amount) {
                        cursor.close();
                        throw new DiscordClientError('No airports could be found with that criteria...');
                    }
                    const airports = await cursor.limit(limit).toArray();
                    const embeds = airports.map((airport, i) => new MessageEmbed({
                        color: "BLUE",
                        title: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()}`,
                        thumbnail: {
                            url: "https://i.ibb.co/rpHM4Jm/hq.png"
                        },
                        footer: {
                            text: `Airport ${i + 1} of ${airports.length}`,
                            iconURL: client.user.displayAvatarURL()
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("Information")), 
                                value: `**City:** ${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}\n**Country:** ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.country_code.toUpperCase()})\n**ICAO:** ${airport.icao.toUpperCase()}\n**IATA:** ${airport.iata.toUpperCase()}` 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Statistics")), 
                                value: `**Market:** ${airport.market}%\n**Runway:** ${airport.runway.toLocaleString(locale)} ft` 
                            }
                        ]
                    }));
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
                        })
                    ];
                    const message = await interaction.editReply({ 
                        embeds: [currentEmbed], 
                        components 
                    });
                    if (amount > 1000) {
                        await interaction.followUp({
                            content: `Found ${amount.toLocaleString(locale)} airports with your criteria. Please note that the bot will only display ${limit.toLocaleString(locale)} of them. Change the limit to display more or less.`,
                            ephemeral: true
                        });
                    }
                    if (embeds.length) {
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000,
                            componentType: "BUTTON"
                        });
                        collector.on("collect", async interaction => {
                            const [action, value] = interaction.customId.split(":");
                            currentEmbed = pages.next(action === "prev" ? -Number(value) : Number(value)).value;
                            await interaction.update({ embeds: [currentEmbed] });
                        });
                        collector.once('end', async collected => {
                            const reply = collected.last() || interaction;
                            for (const row of components) row.components.forEach(component => component.setDisabled(true));
                            await reply.editReply({ components }).catch(() => void 0);
                        });
                    }
                    break;
                }
                case "sell_plane": {
                    const code = interaction.options.getString("hub", true).trim();
                    const plane_input = interaction.options.getString("plane", true).trim();
                    const market = interaction.options.getInteger("market") ?? 89;
                    let gameMode = <GameMode>interaction.options.getString("mode");
                    if (!gameMode) {
                        const user = await userCollection.findOne({ id: interaction.user.id });
                        if (!user?.mode) throw new DiscordClientError('You need to either login with `/user login` or define the game mode option!');
                        gameMode = user.mode;
                    }
                    const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(plane_input));
                    if (!plane) throw new DiscordClientError(`No plane could be found with ${Formatters.bold(plane_input)}...`);
                    const hub = await airportCollection.findOne(createAirportFilter(code));
                    if (!hub) throw new DiscordClientError('That is not a valid airport...');
                    const query: Filter<AM4.Airport> = { market: { $gte: market } };
                    if (gameMode === "Realism") query.runway = { $gte: plane.runway };
                    const cursor = airportCollection.aggregate<GeoNear<AM4.Airport>>([
                        {
                            $geoNear: {
                                near: hub.location,
                                query: query,
                                maxDistance: plane.range * 2 * 1000,
                                minDistance: 100 * 1000,
                                distanceMultiplier: 0.001,
                                distanceField: "dist.calculated",
                                includeLocs: "dist.location",
                                spherical: true
                            }
                        },
                        {
                            $limit: 1
                        }
                    ]);
                    const hasAirport = await cursor.hasNext();
                    if (!hasAirport) {
                        cursor.close();
                        throw new DiscordClientError(`No suitable airport could be found to sell this plane with a market of at least ${market}%...`);
                    }
                    const airport = await cursor.next();
                    const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                    const embed = new MessageEmbed({
                        color: "BLUE",
                        title: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()}`,
                        thumbnail: {
                            url: createAttachmentUrl(image)
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("Information")), 
                                value: `**City:** ${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}\n**Country:** ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.country_code.toUpperCase()})\n**ICAO:** ${airport.icao.toUpperCase()}\n**IATA:** ${airport.iata.toUpperCase()}` 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Statistics")), 
                                value: `**Distance:** ${Math.round(airport.dist.calculated).toLocaleString(locale)} km\n**Market:** ${airport.market}%\n**Runway:** ${airport.runway.toLocaleString(locale)} ft\n**Plane price:** $${Math.round(plane.price * (airport.market / 100)).toLocaleString(locale)}` 
                            }
                        ]
                    });
                    await interaction.editReply({
                        embeds: [embed],
                        files: [image]
                    });
                    break;
                }
                case "stopovers": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const departureCode = interaction.options.getString("departure", true).trim();
                    const arrivalCode = interaction.options.getString("arrival", true).trim();
                    const departure = await airportCollection.findOne(createAirportFilter(departureCode));
                    if (!departure) throw new DiscordClientError("Unknown departure airport");
                    const arrival = await airportCollection.findOne(createAirportFilter(arrivalCode));
                    if (!arrival) throw new DiscordClientError("Unknown arrival airport");
                    const route = [departure, arrival];
                    const locations = route.map(airport => airport.location.coordinates);
                    type Locations = Parameters<typeof Route.distance>;
                    const { distance: originalDistance } = Route.distance(...locations as Locations);
                    const query: Filter<AM4.Airport> = {
                        location: {
                            $geoWithin: {
                                $centerSphere: createLocationSphere(...locations as SphereCoordinates)
                            }
                        }
                    };
                    let gameMode = <GameMode>interaction.options.getString("mode");
                    if (!gameMode) {
                        const user = await userCollection.findOne({ id: interaction.user.id });
                        if (!user?.mode) throw new DiscordClientError('You need to either login with `/user login` or define the game mode option!');
                        gameMode = user.mode;
                    }
                    const planeInput = interaction.options.getString("plane", true).trim();
                    const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeInput));
                    if (gameMode === "Realism") query.runway = { $gte: plane.runway };
                    const cursor = airportCollection.find(query);
                    const amount = await cursor.count();
                    if (!amount) {
                        cursor.close();
                        throw new DiscordClientError("No airports exist between these two airports...");
                    }
                    const airports = await cursor.toArray();
                    const stopoverAmount = interaction.options.getInteger("amount") || 1;
                    const stopovers = Route.findStopovers(route, airports, plane, gameMode, stopoverAmount);
                    if (!stopovers.length) throw new DiscordClientError("No suitable stopovers could be found between these two routes...");
                    const user = await userCollection.findOne({ id: interaction.user.id });
                    const embeds = stopovers.map((stopover, i) => {
                        const stopoverAirports: AM4.Airport[] = stopover.airports.slice(1, stopover.airports.lastIndex());
                        return new MessageEmbed({
                            color: "BLUE",
                            title: `${formatCode(departure, user?.options.code)} to ${formatCode(arrival, user?.options.code)}`,
                            description: `**Additional distance:** ${(stopover.distance - originalDistance).toLocaleString(locale)} km`,
                            thumbnail: {
                                url: "https://i.ibb.co/rpHM4Jm/hq.png"
                            },
                            footer: {
                                text: `Stopover combination ${i + 1} of ${stopovers.length}`,
                                iconURL: client.user.displayAvatarURL()
                            },
                            fields: stopoverAirports.map(airport => ({
                                name: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()}`,
                                value: `**City:** ${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}\n**Country:** ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.country_code.toUpperCase()})\n**ICAO:** ${airport.icao.toUpperCase()}\n**IATA:** ${airport.iata.toUpperCase()}\n**Market:** ${airport.market}%\n**Runway:** ${airport.runway.toLocaleString(locale)} ft`
                            }))
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
                        })
                    ];
                    const message = await interaction.editReply({ embeds: [currentEmbed], components });
                    if (embeds.length) {
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000,
                            componentType: "BUTTON"
                        });
                        collector.on("collect", async interaction => {
                            const [action, value] = interaction.customId.split(":");
                            currentEmbed = pages.next(action === "prev" ? -Number(value) : Number(value)).value;
                            await interaction.update({ embeds: [currentEmbed] });
                        });
                        collector.once('end', async collected => {
                            const reply = collected.last() || interaction;
                            for (const row of components) row.components.forEach(component => component.setDisabled(true));
                            await reply.editReply({ components }).catch(() => void 0);
                        });
                    }
                    break;
                }
                case "geo": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    let airports: AM4.Airport[] = [], amount: number;
                    const limit = interaction.options.getInteger("limit") || 1000;
                    switch(subCommand) {
                        case "near": {
                            const airport_input = interaction.options.getString("airport", true).trim();
                            const min_distance = interaction.options.getInteger("min_distance", true);
                            const max_distance = interaction.options.getInteger("max_distance", true);
                            const airport = await airportCollection.findOne(createAirportFilter(airport_input));
                            if (!airport) throw new DiscordClientError("Unknown airport");
                            const found_airports = airportCollection.find({
                                location: {
                                    $near: {
                                        $geometry: airport.location,
                                        $minDistance: min_distance * 1000,
                                        $maxDistance: max_distance * 1000
                                    }
                                }
                            });
                            amount = await found_airports.count();
                            airports = await found_airports.limit(limit).toArray();
                            break;
                        }
                        case "box": {
                            const options = interaction.options.data[0].options[0].options;
                            const locations = await Promise.all(
                                options.map(async option => {
                                    const input = (<string>option.value).trim();
                                    const airport = await airportCollection.findOne(createAirportFilter(input));
                                    if (!airport) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} Unknown airport`);
                                    return airport.location;
                                })
                            );
                            const found_airports = airportCollection.find({
                                location: {
                                    $geoWithin: {
                                        $box: createLocationBox(...locations.map(location => location.coordinates) as BoxCoordinates)
                                    }
                                }
                            });
                            amount = await found_airports.count();
                            airports = await found_airports.limit(limit).toArray();
                            break;
                        }
                        case "polygon": {
                            const options = interaction.options.data[0].options[0].options;
                            const locations = await Promise.all(
                                options.map(async option => {
                                    const input = (<string>option.value).trim();
                                    const airport = await airportCollection.findOne(createAirportFilter(input));
                                    if (!airport) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} Unknown airport`);
                                    return airport.location;
                                })
                            );
                            const found_airports = airportCollection.find({
                                location: {
                                    $geoWithin: {
                                        $polygon: locations.map(location => location.coordinates)
                                    }
                                }
                            });
                            amount = await found_airports.count();
                            airports = await found_airports.limit(limit).toArray();
                            break;
                        }
                    }
                    if (!airports.length) throw new DiscordClientError('No airports could be found with that criteria...');
                    const embeds = airports.map((airport, i) => {
                        return new MessageEmbed({
                            color: "BLUE",
                            title: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()}`,
                            thumbnail: {
                                url: "https://i.ibb.co/rpHM4Jm/hq.png"
                            },
                            footer: {
                                text: `Airport ${i + 1} of ${airports.length}`,
                                iconURL: client.user.displayAvatarURL()
                            },
                            fields: [
                                { 
                                    name: Formatters.bold(Formatters.underscore("Information")), 
                                    value: `**City:** ${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}\n**Country:** ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.country_code.toUpperCase()})\n**ICAO:** ${airport.icao.toUpperCase()}\n**IATA:** ${airport.iata.toUpperCase()}` 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Statistics")), 
                                    value: `**Market:** ${airport.market}%\n**Runway:** ${airport.runway.toLocaleString(locale)} ft` 
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
                        })
                    ];
                    const message = await interaction.editReply({ embeds: [currentEmbed], components });
                    if (amount > 1000) {
                        await interaction.followUp({
                            content: `Found ${amount.toLocaleString(locale)} airports with your criteria. Please note that the bot will only display ${limit.toLocaleString(locale)} of them. Change the limit to display more or less.`,
                            ephemeral: true
                        });
                    }
                    if (embeds.length) {
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000,
                            componentType: "BUTTON" 
                        });
                        collector.on("collect", async interaction => {
                            const [action, value] = interaction.customId.split(":");
                            currentEmbed = pages.next(action === "prev" ? -Number(value) : Number(value)).value;
                            await interaction.update({ embeds: [currentEmbed] });
                        });
                        collector.once('end', async collected => {
                            const reply = collected.last() ?? interaction;
                            for (const row of components) row.components.forEach(component => component.setDisabled(true));
                            await reply.editReply({ components });
                        });
                    }
                    break;
                }
                case "compare": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const options = interaction.options.data[0].options;
                    const airports = await Promise.all<Airport>(
                        options.map(async option => {
                            const airport = await airportCollection.findOne(createAirportFilter(<string>option.value));
                            if (!airport) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} Unknown airport`);
                            const routes = await routeCollection.find({ airports: airport._id }).toArray();
                            return {
                                ...airport,
                                totalPax: routes.map(route => route.demand.Y + route.demand.J * 2 + route.demand.F * 3).reduce((a, b) => a + b),
                                totalCargo: routes.map(route => route.demand.H + Plane.largeToHeavy(route.demand.L)).reduce((a, b) => a + b),
                                average_demand: {
                                    Y: Math.round(routes.map(route => route.demand.Y).reduce((a, b) => a + b) / routes.length),
                                    J: Math.round(routes.map(route => route.demand.J).reduce((a, b) => a + b) / routes.length),
                                    F: Math.round(routes.map(route => route.demand.F).reduce((a, b) => a + b) / routes.length),
                                    L: Math.round(routes.map(route => route.demand.L).reduce((a, b) => a + b) / routes.length),
                                    H: Math.round(routes.map(route => route.demand.H).reduce((a, b) => a + b) / routes.length)
                                }
                            }
                        })
                    );
                    const graphs = [
                        {
                            id: new ObjectId(),
                            type: "Bar graph",
                            description: "Bar graph comparing the market percentage and runway lengths of the airports. The y-axis on the left displays the market percentage and the y-axis on the right displays the runway length.",
                            data: {
                                type: 'bar',
                                data: {
                                    labels: airports.map(airport => airport.city.capitalizeWords({ capitalizeAfterQuote: true })),
                                    datasets: [ 
                                        {
                                            label: 'Market',
                                            backgroundColor: 'rgb(38, 226, 144)',
                                            data: airports.map(airport => airport.market),
                                            yAxisID: 'A'
                                        },
                                        {
                                            label: 'Runway',
                                            backgroundColor: 'rgb(181, 82, 223)',
                                            data: airports.map(airport => airport.runway),
                                            yAxisID: 'B'
                                        }
                                    ]
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Market & Runway length',
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
                                                id: 'A',
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    suggestedMin: 0,
                                                    suggestedMax: 100,
                                                    callback: (val: number) => `${val.toLocaleString('en')}%`
                                                }
                                            },
                                            {
                                                id: 'B',
                                                position: 'right',
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    suggestedMin: 0,
                                                    callback: (val: number) => `${val.toLocaleString('en')} ft`
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
                        },
                        {
                            id: new ObjectId(),
                            type: "Bar graph",
                            description: `Bar graph comparing the total pax and cargo demands of the airports based on ${interaction.client.user.username}'s route data.`,
                            data: {
                                type: 'bar',
                                data: {
                                    labels: airports.map(airport => airport.city.capitalizeWords({ capitalizeAfterQuote: true })),
                                    datasets: [ 
                                        {
                                            label: 'Pax',
                                            backgroundColor: 'rgb(38, 138, 226)',
                                            data: airports.map(airport => airport.totalPax),
                                            yAxisID: 'A'
                                        },
                                        {
                                            label: 'Cargo',
                                            backgroundColor: 'rgb(230, 27, 54)',
                                            data: airports.map(airport => airport.totalCargo),
                                            yAxisID: 'B'
                                        }
                                    ]
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Total Demand',
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
                                                id: 'A',
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    suggestedMin: 0,
                                                    suggestedMax: 100,
                                                    callback: (val: number) => `${val.toLocaleString('en')} pax`
                                                }
                                            },
                                            {
                                                id: 'B',
                                                position: 'right',
                                                type: 'logarithmic',
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
                        },
                        {
                            id: new ObjectId(),
                            type: "Radar graph",
                            description: "Radar graph comparing the average demand of the airports. The large and heavy demands are displayed in thousands.",
                            data: {
                                type: "radar",
                                data: {
                                    labels: [
                                        'Economy Class',
                                        'Business Class',
                                        'First Class',
                                        'Large Load (k)',
                                        'Heavy Load (k)'
                                    ],
                                    datasets: airports.map(airport => ({
                                        label: airport.city.capitalizeWords({ capitalizeAfterQuote: true }),
                                        data: [
                                            airport.average_demand.Y,
                                            airport.average_demand.J,
                                            airport.average_demand.F,
                                            airport.average_demand.L / 1000,
                                            airport.average_demand.H / 1000
                                        ]
                                    }))
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Average Demand',
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
                        }
                    ];
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
                        title: "Airport comparing",
                        description: graphs[0].description,
                        image: {
                            url: await chart.getShortUrl()
                        }
                    });
                    const row = new MessageActionRow({ components: [select] });
                    const message = await interaction.editReply({ 
                        embeds: [embed], 
                        components: [row] 
                    });
                    const collector = message.createMessageComponentCollector({ 
                        filter: ({ user }) => user.id === interaction.user.id, 
                        idle: 10 * 60 * 1000,
                        componentType: "SELECT_MENU" 
                    });
                    collector.on("collect", async interaction => {
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
                    });
                    collector.once("end", async collected => {
                        row.setComponents(select.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(() => void 0);
                    });
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
                const planes = database.am4.collection<AM4.Plane>("Planes");
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
                const airports = database.am4.collection<AM4.Airport>("Airports");
                const query: Filter<AM4.Airport> = value && {
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
                    name: `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country_code.toUpperCase()} (${airport.iata.toUpperCase()}/${airport.icao.toUpperCase()})`,
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