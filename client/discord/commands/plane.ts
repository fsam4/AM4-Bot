import { MessageEmbed, Permissions, MessageAttachment, MessageActionRow, MessageButton, MessageSelectMenu, Formatters, Constants, Team, type ApplicationCommandOptionChoice } from 'discord.js';
import { ObjectId, type Filter, type Document } from 'mongodb';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';
import * as Utils from '../../utils';
import Plane from '../../../src/lib/plane';

import type { AM4, Settings } from '@typings/database';
import type { SlashCommand } from '@discord/types';
import type { GameMode } from '@typings/am4-api';

type AircraftWithEngine = AM4.Plane & { engineName: string };

const { createAttachmentUrl, isCachedCommandInteraction } = Utils.Discord;
const { createTextFilter } = Utils.MongoDB;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.ATTACH_FILES,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS
    ]),
    data: {
        name: 'plane',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Search or compare planes and manage plane settings",
        defaultPermission: true,
        options: [
            {
                name: 'search',
                description: 'Search for a certain plane',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'name',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'default',
                        description: 'Whether to show default statistics or apply your settings to the statistics.',
                        type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: 'The game mode to calculate the statistics by. On default your saved game mode.',
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
                name: 'filter',
                description: 'Filter planes by statistics',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'manufacturer',
                        description: 'The manufacturer of the planes',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: "Aerospatiale",
                                value: "Aerospatiale"
                            },
                            {
                                name: "Airbus",
                                value: "Airbus"
                            },
                            {
                                name: "Antonov",
                                value: "Antonov"
                            },
                            {
                                name: "British Aerospace",
                                value: "British Aerospace"
                            },
                            {
                                name: "Beechcraft",
                                value: "Beechcraft"
                            },
                            {
                                name: "Boeing",
                                value: "Boeing"
                            },
                            {
                                name: "Bombardier",
                                value: "Bombardier"
                            },
                            {
                                name: "Cessna",
                                value: "Cessna"
                            },
                            {
                                name: "Comac",
                                value: "Comac"
                            },
                            {
                                name: "Embraer",
                                value: "Embraer"
                            },
                            {
                                name: "Fokker",
                                value: "Fokker"
                            },
                            {
                                name: "Ilyushin",
                                value: "Ilyushin"
                            },
                            {
                                name: "Lockheed",
                                value: "Lockheed"
                            },
                            {
                                name: "McDonnell Douglas",
                                value: "McDonnell Douglas"
                            },
                            {
                                name: "Sud Aviation",
                                value: "Sud Aviation"
                            },
                            {
                                name: "Sukhoi",
                                value: "Sukhoi"
                            },
                            {
                                name: "Tupolev",
                                value: "Tupolev"
                            },
                            {
                                name: "Other",
                                value: "Other"
                            }
                        ]
                    },
                    {
                        name: 'type',
                        description: 'The type of the planes',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: "Pax",
                                value: "pax"
                            },
                            {
                                name: "Cargo",
                                value: "cargo"
                            },
                            {
                                name: "VIP",
                                value: "vip"
                            }
                        ]
                    },
                    {
                        name: 'min_fuel',
                        description: 'Minimum fuel/km usage of the planes',
                        type: Constants.ApplicationCommandOptionTypes.NUMBER,
                        required: false
                    },
                    {
                        name: 'max_fuel',
                        description: 'Maximum fuel/km usage of the planes',
                        type: Constants.ApplicationCommandOptionTypes.NUMBER,
                        required: false
                    },
                    {
                        name: 'min_co2',
                        description: 'Minimum co2 usage of the planes',
                        type: Constants.ApplicationCommandOptionTypes.NUMBER,
                        required: false
                    },
                    {
                        name: 'max_co2',
                        description: 'Maximum co2 usage of the planes',
                        type: Constants.ApplicationCommandOptionTypes.NUMBER,
                        required: false
                    },
                    {
                        name: 'min_runway',
                        description: 'Minimum runway length of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_runway',
                        description: 'Maximum runway length of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_range',
                        description: 'Minimum range of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_range',
                        description: 'Maximum range of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_price',
                        description: 'Minimum price of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_price',
                        description: 'Maximum price of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_capacity',
                        description: 'Minimum capacity of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_capacity',
                        description: 'Maximum capacity of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_speed',
                        description: 'Minimum speed of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_speed',
                        description: 'Maximum speed of the planes',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_check_price',
                        description: 'Minimum A-check cost of the plane',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_check_price',
                        description: 'Maximum A-check cost of the plane',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'min_check_time',
                        description: 'Minimum A-check time (in hours) of the plane',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'max_check_time',
                        description: 'Maximum A-check time (in hours) of the plane',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: 'The game mode to calculate the statistics by. On default your saved game mode.',
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
                description: 'Compare planes with graphs',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'plane_1',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'plane_2',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'plane_3',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'plane_4',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'plane_5',
                        description: 'The full name of the plane',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: false
                    },
                    {
                        name: 'mode',
                        description: 'The game mode to calculate the statistics by. By default the mode of your airline.',
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
                name: 'settings',
                description: 'Manage plane settings',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'create',
                        description: 'Create new settings for a plane',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane that you want to create the settings for',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'fuel_modification',
                                description: 'Whether to use fuel modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'speed_modification',
                                description: 'Whether to use speed modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'co2_modification',
                                description: 'Whether to use co2 modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'engine',
                                description: 'The engine to use on this plane',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'edit',
                        description: 'Edit the settings for a plane',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane that you want to edit the settings for',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'fuel_modification',
                                description: 'Whether to use fuel modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'speed_modification',
                                description: 'Whether to use speed modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'co2_modification',
                                description: 'Whether to use co2 modification on this plane',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'engine',
                                description: 'The engine to use on this plane',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'delete',
                        description: 'Delete the settings of a plane',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane that you want to delete from your settings',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'view',
                        description: 'View your active plane settings',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane that you want to delete from your settings',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
    
                                autocomplete: true,
                                required: true
                            }
                        ]
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, account, ephemeral, locale }) {
        const group = interaction.options.getSubcommandGroup(false);
        await interaction.deferReply({ ephemeral: (ephemeral || group === 'settings') && interaction.inGuild() });
        try {
            const subCommand = interaction.options.getSubcommand();
            const planeSettings = database.settings.collection<Settings.Plane>('Planes');
            const planeCollection = database.am4.collection<AM4.Plane>('Planes');
            const userCollection = database.settings.collection<Settings.User>('Users');
            const user = await userCollection.findOne({ id: interaction.user.id });
            const options = {
                salaries: user?.salaries,
                co2Price: user?.options.co2_price,
                fuelPrice: user?.options.fuel_price,
                activity: user?.options.activity ?? 18,
                reputation: 100
            };
            switch(group || subCommand) {
                case "search": {
                    const plane_input = interaction.options.getString("name", true).trim();
                    let gameMode = <GameMode>interaction.options.getString("mode")?.trim();
                    if (!gameMode) {
                        if (!user?.mode) throw new DiscordClientError('You need to either login with `/user login` or define the game mode option!');
                        gameMode = user.mode;
                    }
                    let plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(plane_input));
                    if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(plane_input)}...`);
                    let default_stats = interaction.options.getBoolean("default");
                    let engine_name = "none", modifications = {
                        speed: false,
                        fuel: false,
                        co2: false
                    };
                    if (!default_stats) {
                        const plane_settings = await planeSettings.findOne({
                            id: interaction.user.id,
                            planeID: plane._id
                        });
                        if (plane_settings) {
                            modifications = plane_settings.modifications;
                            if (plane_settings.engine) {
                                const engine = plane.engines.find(engine => engine.name === plane_settings.engine);
                                plane.fuel = engine.fuel;
                                plane.speed = engine.speed;
                                engine_name = engine.name;
                            }
                        }
                        if (user?.training.fuel) plane.fuel *= (100 - user.training.fuel) / 100;
                        if (user?.training.co2) plane.co2 *= (100 - user.training.co2) / 100;
                        if (modifications.co2) plane.co2 *= 0.9;
                        if (modifications.fuel) plane.fuel *= 0.9;
                        if (modifications.speed) plane.speed *= 1.1;
                    }
                    let easy = {
                        profit: Plane.profit(plane, { ...options, gameMode: "Easy" }).profit,
                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Easy" })
                    };
                    let realism = {
                        profit: Plane.profit(plane, { ...options, gameMode: "Realism" }).profit,
                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Realism" })
                    };
                    const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                    const embed = new MessageEmbed({
                        color: "WHITE",
                        timestamp: plane._id.getTimestamp(),
                        description: `**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`,
                        image: {
                            url: createAttachmentUrl(image)
                        },
                        author: {
                            name: plane.name,
                            iconURL: plane.manufacturer.icon
                        },
                        footer: {
                            text: `engine: ${engine_name}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("General statistics")), 
                                value: `**Speed:** ${Math.round(gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                inline: true 
                            },
                            { 
                                name: '\u200B', 
                                value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round((gameMode === "Easy" || default_stats) ? plane.A_check.price / 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                inline: true 
                            },
                            { 
                                name: '\u200B', 
                                value: '\u200B', 
                                inline: false 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Profit (realism)")), 
                                value: `**Per hour:** $${Math.round(realism.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${realism.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(realism.profit * 7).toLocaleString(locale)}\n**Share value:** $${realism.sv.toFixed(2)}/day`, 
                                inline: true 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Profit (easy)")), 
                                value: `**Per hour:** $${Math.round(easy.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${easy.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(easy.profit * 7).toLocaleString(locale)}\n**Share value:** $${easy.sv.toFixed(2)}/day`, 
                                inline: true 
                            }
                        ]
                    });
                    if (plane.price) {
                        const profitabilityRealism = Math.round(plane.price / realism.profit);
                        embed.fields[3].value += `\n**Profitability:** ${profitabilityRealism > 0 ? `in ${profitabilityRealism.toLocaleString(locale)} days` : 'never' }`;
                        const profitabilityEasy = Math.round(plane.price / easy.profit);
                        embed.fields[4].value += `\n**Profitability:** ${profitabilityEasy > 0 ? `in ${profitabilityEasy.toLocaleString(locale)} days` : 'never' }`;
                        const purchaseSV = Plane.estimatedShareValueFromPurchase(plane.price);
                        embed.description += `\n**SV from purchase:** $${purchaseSV.toFixed(2)}`;
                    }
                    if (isCachedCommandInteraction(interaction)) {
                        const engineSelect = new MessageSelectMenu({
                            placeholder: "Select engine...",
                            customId: "engine",
                            options: [
                                {
                                    label: "none",
                                    value: "none",
                                    default: false
                                },
                                ...plane.engines.map(engine => ({
                                    label: engine.name,
                                    value: engine.name,
                                    default: engine_name === engine.name
                                }))
                            ]
                        });
                        const modSelect = new MessageSelectMenu({
                            placeholder: "Select modifications...",
                            customId: "modifications",
                            maxValues: 3,
                            minValues: 0,
                            options: [
                                {
                                    label: "Speed Modification",
                                    value: "speed",
                                    emoji: emojis.status,
                                    default: (modifications.speed && !default_stats)
                                },
                                {
                                    label: "Fuel Modification",
                                    value: "fuel",
                                    emoji: emojis.fuel,
                                    default: (modifications.fuel && !default_stats)
                                },
                                {
                                    label: "Co2 Modification",
                                    value: "co2",
                                    emoji: emojis.co2,
                                    default: (modifications.co2 && !default_stats)
                                }
                            ]
                        });
                        const message = await interaction.editReply({
                            embeds: [embed],
                            files: [image],
                            components: [
                                new MessageActionRow({ components: [engineSelect] }),
                                new MessageActionRow({ components: [modSelect] })
                            ]
                        });
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000,
                            componentType: "SELECT_MENU" 
                        });
                        collector.on("collect", async interaction => {
                            await interaction.deferUpdate();
                            switch(interaction.customId) {
                                case "engine": {
                                    engine_name = interaction.values[0];
                                    if (engine_name === "none") {
                                        const original_plane = await planeCollection.findOne({ $text: { $search: `"${plane_input}"` } });
                                        plane.fuel = original_plane.fuel;
                                        plane.speed = original_plane.speed;
                                        for (const option of engineSelect.options) option.default = false;
                                    } else {
                                        const engine = plane.engines.find(engine => engine.name === engine_name);
                                        plane.fuel = engine.fuel;
                                        plane.speed = engine.speed;
                                        for (const option of engineSelect.options) {
                                            option.default = interaction.values.includes(option.value);
                                        }
                                    }
                                    if (modifications.fuel) plane.fuel *= 0.9;
                                    if (modifications.speed) plane.speed *= 1.1;
                                    if (!default_stats && user?.training.fuel) plane.fuel *= (100 - user.training.fuel) / 100;
                                    easy = {
                                        profit: Plane.profit(plane, { ...options, gameMode: "Easy" }).profit,
                                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Easy" })
                                    };
                                    realism = {
                                        profit: Plane.profit(plane, { ...options, gameMode: "Realism" }).profit,
                                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Realism" })
                                    };
                                    break;
                                }
                                case "modifications": {
                                    if (modifications.co2) plane.co2 /= 0.9;
                                    if (modifications.fuel) plane.fuel /= 0.9;
                                    if (modifications.speed) plane.speed /= 1.1;
                                    for (const modification in modifications) {
                                        if (interaction?.values.includes(modification)) {
                                            modifications[modification] = true;
                                        } else {
                                            modifications[modification] = false;
                                        }
                                    }
                                    if (modifications.co2) plane.co2 *= 0.9;
                                    if (modifications.fuel) plane.fuel *= 0.9;
                                    if (modifications.speed) plane.speed *= 1.1;
                                    for (const option of modSelect.options) {
                                        if (interaction?.values?.includes(option.value)) {
                                            option.default = true;
                                        } else {
                                            option.default = false;
                                        }
                                    }
                                    easy = {
                                        profit: Plane.profit(plane, { ...options, gameMode: "Easy" }).profit,
                                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Easy" })
                                    };
                                    realism = {
                                        profit: Plane.profit(plane, { ...options, gameMode: "Realism" }).profit,
                                        sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Realism" })
                                    };
                                    break;
                                }
                            }
                            embed.setImage(createAttachmentUrl(image));
                            embed.setFooter({
                                text: `engine: ${engine_name}`, 
                                iconURL: interaction.client.user.displayAvatarURL()
                            });
                            embed.setFields([
                                { 
                                    name: Formatters.bold(Formatters.underscore("General statistics")), 
                                    value: `**Speed:** ${Math.round(gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                    inline: true 
                                },
                                { 
                                    name: '\u200B', 
                                    value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round((gameMode === "Easy" || default_stats) ? plane.A_check.price / 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                    inline: true 
                                },
                                { 
                                    name: '\u200B', 
                                    value: '\u200B', 
                                    inline: false 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profit (realism)")), 
                                    value: `**Per hour:** $${Math.round(realism.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${realism.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(realism.profit * 7).toLocaleString(locale)}\n**Share value:** $${realism.sv.toFixed(2)}/day`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profit (easy)")), 
                                    value: `**Per hour:** $${Math.round(easy.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${easy.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(easy.profit * 7).toLocaleString(locale)}\n**Share value:** $${easy.sv.toFixed(2)}/day`, 
                                    inline: true 
                                }
                            ]);
                            if (plane.price) {
                                const profitabilityRealism = Math.round(plane.price / realism.profit);
                                embed.fields[3].value += `\n**Profitability:** ${profitabilityRealism > 0 ? `in ${profitabilityRealism.toLocaleString(locale)} days` : 'never' }`;
                                const profitabilityEasy = Math.round(plane.price / easy.profit);
                                embed.fields[4].value += `\n**Profitability:** ${profitabilityEasy > 0 ? `in ${profitabilityEasy.toLocaleString(locale)} days` : 'never' }`;
                            }
                            await interaction.editReply({ 
                                embeds: [embed],
                                components: [
                                    new MessageActionRow({ components: [engineSelect] }),
                                    new MessageActionRow({ components: [modSelect] })
                                ]
                            });
                        });
                        collector.once("end", async collected => {
                            const reply = collected.last() || interaction;
                            await reply.editReply({
                                components: [
                                    new MessageActionRow({ components: [engineSelect.setDisabled(true)] }),
                                    new MessageActionRow({ components: [modSelect.setDisabled(true)] })
                                ]
                            })
                            .catch(() => void 0);
                        });
                    } else {
                        await interaction.editReply({
                            embeds: [embed],
                            files: [image]
                        });
                    }
                    break;
                }
                case "filter": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    let query: Filter<AM4.Plane> = {};
                    const commandOptions = interaction.options.data[0].options.filter(option => option.name !== "mode");
                    let gameMode = <GameMode>interaction.options.getString("mode")?.trim();
                    if (!gameMode) {
                        if (!user?.mode) throw new DiscordClientError('You need to either login with `/user login` or define the game mode option!');
                        gameMode = user.mode;
                    }
                    for (const option of commandOptions) {
                        switch(option.type) {
                            case "STRING":
                                const prop = option.name === "manufacturer" ? "manufacturer.name" : option.name;
                                query[prop] = (<string>option.value).trimEnd();
                                break;
                            case "INTEGER": {
                                const [type, prop, subProp] = option.name.split('_');
                                if (prop === "check") {
                                    if (subProp === "price" && gameMode === "Easy" && typeof option.value === "number") option.value *= 2;
                                    const filter = (type === 'max' ? { $lte: option.value } : { $gte: option.value });
                                    query[`A_check.${subProp}`] = filter;
                                } else {
                                    const filter = (type === 'max' ? { $lte: option.value } : { $gte: option.value });
                                    query[prop] = filter;
                                }
                                break;
                            }
                            case "NUMBER": {
                                const [type, prop] = option.name.split('_');
                                query[prop] = (type === 'max' ? { $lte: option.value } : { $gte: option.value });
                                break;
                            }
                        }
                    }
                    const planes = await planeCollection.aggregate<AircraftWithEngine>([
                        {
                            $unwind: {
                                path: '$engines',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                name: true,
                                price: true,
                                range: true,
                                runway: true,
                                capacity: true,
                                type: true,
                                image: true,
                                manufacturer: true,
                                staff: true,
                                engines: true,
                                co2: true,
                                A_check: true,
                                bonus_points: true,
                                engineName: {
                                    $cond: {
                                        if: { $eq: [{ $type: "$engines" }, "object"] },
                                        then: '$engines.name',
                                        else: "default"
                                    }
                                },
                                fuel: {
                                    $cond: {
                                        if: { $eq: [{ $type: "$engines" }, "object"] },
                                        then: '$engines.fuel',
                                        else: '$fuel'
                                    }
                                },
                                speed: {
                                    $cond: {
                                        if: { $eq: [{ $type: "$engines" }, "object"] },
                                        then: '$engines.speed',
                                        else: '$speed'
                                    }
                                }
                            }
                        },
                        {
                            $match: query
                        }
                    ]).toArray();
                    if (!planes.length) throw new DiscordClientError('No planes were found with that criteria');
                    const embeds = planes.map((plane, i) => {
                        const easy = {
                            profit: Plane.profit(plane, { ...options, gameMode: "Easy" }).profit,
                            sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Easy" })
                        };
                        const realism = {
                            profit: Plane.profit(plane, { ...options, gameMode: "Realism" }).profit,
                            sv: Plane.estimatedShareValueGrowth(plane, { ...options, gameMode: "Realism" })
                        };
                        const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                        const embed = new MessageEmbed({
                            color: "WHITE",
                            timestamp: plane._id.getTimestamp(),
                            image: {
                                url: createAttachmentUrl(image),
                            },
                            author: {
                                name: plane.name,
                                iconURL: plane.manufacturer.icon
                            },
                            footer: {
                                text: `Plane ${i + 1} of ${planes.length}`,
                                iconURL: interaction.client.user.displayAvatarURL()
                            },
                            description: `**Engine:** ${plane.engineName}`,
                            fields: [
                                { 
                                    name: Formatters.bold(Formatters.underscore("General statistics")), 
                                    value: `**Speed:** ${Math.round(gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                    inline: true 
                                },
                                { 
                                    name: '\u200B', 
                                    value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(gameMode === "Easy" ? plane.A_check.price / 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                    inline: true 
                                },
                                { 
                                    name: '\u200B', 
                                    value: '\u200B', 
                                    inline: false 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profit (realism)")), 
                                    value: `**Per hour:** $${Math.round(realism.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${realism.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(realism.profit * 7).toLocaleString(locale)}\n**Share value:** $${realism.sv.toFixed(2)}/day`, 
                                    inline: true 
                                },
                                { 
                                    name: Formatters.bold(Formatters.underscore("Profit (easy)")), 
                                    value: `**Per hour:** $${Math.round(easy.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${easy.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(easy.profit * 7).toLocaleString(locale)}\n**Share value:** $${easy.sv.toFixed(2)}/day`, 
                                    inline: true 
                                }
                            ]
                        });
                        if (plane.price) {
                            const profitabilityRealism = Math.round(plane.price / realism.profit);
                            embed.fields[3].value += `\n**Profitability:** ${profitabilityRealism > 0 ? `in ${profitabilityRealism.toLocaleString(locale)} days` : 'never' }`;
                            const profitabilityEasy = Math.round(plane.price / easy.profit);
                            embed.fields[4].value += `\n**Profitability:** ${profitabilityEasy > 0 ? `in ${profitabilityEasy.toLocaleString(locale)} days` : 'never' }`;
                            const purchaseSV = Plane.estimatedShareValueFromPurchase(plane.price);
                            embed.description += `\n**SV from purchase:** $${purchaseSV.toFixed(2)}`;
                        }
                        return {
                            attachment: image,
                            value: embed
                        }
                    });
                    const pages = embeds.toGenerator();
                    let currentPage = pages.next(1).value;
                    const components = [
                        new MessageActionRow().addComponents([
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
                        ])
                    ];
                    const message = await interaction.editReply({ 
                        embeds: [currentPage.value],
                        files: [currentPage.attachment], 
                        components 
                    });
                    if (embeds.length) {
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000,
                            componentType: "BUTTON" 
                        });
                        collector.on("collect", async interaction => {
                            const [action, value] = interaction.customId.split(":");
                            currentPage = pages.next(action === "prev" ? -Number(value) : Number(value)).value;
                            await interaction.message.removeAttachments();
                            await interaction.update({ 
                                embeds: [currentPage.value],
                                files: [currentPage.attachment]
                            });
                        });
                        collector.once('end', async collected => {
                            const reply = collected.last() || interaction;
                            for (const row of components) row.components.forEach(component => component.setDisabled(true));
                            await reply.editReply({ components }).catch(() => void 0);
                        });
                    }
                    break;
                }
                case "compare": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    let gameMode = <GameMode>interaction.options.getString("mode")?.trim();
                    if (!gameMode) {
                        if (!user?.mode) throw new DiscordClientError('You need to either login with `/user login` or define the game mode option!');
                        gameMode = user.mode;
                    }
                    const commandOptions = interaction.options.data[0].options.filter(option => option.name.startsWith("plane"));
                    const planes = await Promise.all(
                        commandOptions.map(async option => {
                            const planeName = (<string>option.value).trim();
                            const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeName));
                            if (!plane) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} No plane could be found with ${Formatters.bold(planeName)}...`);
                            return plane;
                        })
                    );
                    const values: number[] = [];
                    const graphs = [
                        {
                            id: new ObjectId(),
                            type: "Bar graph",
                            description: "Bar graph comparing the profit, expenses and income of the planes. The gray poles are error bars that display the error margin of the profit depending on which engine you use.",
                            data: {
                                type: 'bar',
                                data: {
                                    labels: [
                                        "Profit",
                                        "Expenses",
                                        "Income"
                                    ],
                                    datasets: planes.map(plane => {
                                        const engines = plane.engines.map(engine => {
                                            const res = Plane.profit(
                                                {
                                                    ...plane,
                                                    fuel: engine.fuel,
                                                    speed: engine.speed
                                                },
                                                {
                                                    gameMode
                                                }
                                            );
                                            for (const prop in res) {
                                                values.push(res[prop]);
                                            }
                                            return res;
                                        });
                                        const res = Plane.profit(plane, { gameMode });
                                        engines.push(res);
                                        for (const prop in res) {
                                            values.push(res[prop]);
                                        }
                                        return {
                                            label: plane.name,
                                            borderWidth: 1,
                                            data: [
                                                res.profit, 
                                                res.expenses, 
                                                res.income
                                            ],
                                            errorBars: {
                                                "Profit": {
                                                    plus: Math.max(...engines.map(res => res.profit)) - res.profit,
                                                    minus: res.profit - Math.min(...engines.map(res => res.profit))
                                                },
                                                "Expenses": {
                                                    plus: Math.max(...engines.map(res => res.expenses)) - res.expenses,
                                                    minus: res.expenses - Math.min(...engines.map(res => res.expenses))
                                                },
                                                "Income": {
                                                    plus: Math.max(...engines.map(res => res.income)) - res.income,
                                                    minus: res.income - Math.min(...engines.map(res => res.income))
                                                }
                                            }
                                        }
                                    })
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Plane Profitability',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    plugins: {
                                        tickFormat: {
                                            style: 'currency',
                                            currency: 'USD',
                                            minimumFractionDigits: 0
                                        },
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        },
                                        chartJsPluginErrorBars: {
                                            color: "#aaa",
                                        }
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                            display: true,
                                            position: 'right',
                                            align: 'start'
                                        }
                                    },
                                    scales: {
                                        yAxes: [
                                            {
                                                beginAtZero: true,
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    suggestedMin: Math.min(...values),
                                                    suggestedMax: Math.max(...values)
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                type: 'category',
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
                            description: "Radar graph comparing the staff requirements of the planes. The wider the covered area is the more the plane needs staff overall.",
                            data: {
                                type: "radar",
                                data: {
                                    labels: [
                                        'Pilots',
                                        'Crew',
                                        'Engineers',
                                        'Tech'
                                    ],
                                    datasets: planes.map(({ staff, name }) => ({
                                        label: name,
                                        data: [
                                            staff.pilots,
                                            staff.crew,
                                            staff.engineers,
                                            staff.tech
                                        ]
                                    }))
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Plane Staff',
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
                            type: "Scatter graph",
                            description: "Scatter graph comparing the A-check requirements of the planes. The y-axe displays the hours until every A-check and the x-axe displays the A-check price.",
                            data: {
                                type: 'scatter',
                                data: {
                                    datasets: planes.map(({ A_check, name }) => ({
                                        label: name,
                                        data: [
                                            {
                                                x: gameMode === "Easy" ? A_check.price / 2 : A_check.price,
                                                y: A_check.time
                                            }
                                        ]
                                    }))
                                },
                                options: {
                                    plugins: {
                                        tickFormat: {
                                            style: 'unit',
                                            unit: 'hour'
                                        },
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'A-check time & price',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                            fontSize: 13,
                                            usePointStyle: true
                                        }
                                    },
                                    scales: {
                                        yAxes: [
                                            {
                                                display: true,
                                                scaleLabel: {
                                                    display: true,
                                                    labelString: 'Hours',
                                                    fontColor: "#191",
                                                    fontFamily: "Mono",
                                                    fontSize: 20,
                                                    fontStyle: "bold",
                                                    padding: {
                                                        top: 20,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0
                                                    }
                                                },
                                                ticks: {
                                                    precision: 0,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white'
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                display: true,
                                                scaleLabel: {
                                                    display: true,
                                                    labelString: 'Price',
                                                    fontColor: "#191",
                                                    fontFamily: "Mono",
                                                    fontSize: 20,
                                                    fontStyle: "bold",
                                                    padding: {
                                                        top: 20,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0
                                                    }
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    callback: (val: number) => `$${val.toLocaleString('en')}`
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            id: new ObjectId(),
                            type: "Horizontal bar graph",
                            description: "Horizontal bar graph comparing the fuel usages of the planes. The graph displays every engine of each plane and their fuel usages as bar heigths.",
                            data: {
                                type: 'horizontalBar',
                                data: {
                                    labels: planes.map(plane => plane.name),
                                    datasets: planes.flatMap(plane => plane.engines.map(engine => ({
                                        label: engine.name,
                                        borderWidth: 1,
                                        data: [
                                            {
                                                x: engine.fuel,
                                                y: plane.name
                                            }
                                        ]                       
                                    })))
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: 'Fuel Usage',
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
                                                    callback: (val: number) => `${val} lbs/km`
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            id: new ObjectId(),
                            type: "Scatter graph",
                            description: "Scatter graph comparing the speed and range of the planes. The y-axe displays the speed and the x-axe displays the range.",
                            data: {
                                type: 'scatter',
                                data: {
                                    datasets: planes.map(plane => ({
                                        label: plane.name,
                                        data: [
                                            {
                                                x: plane.range,
                                                y: gameMode === "Easy" ? plane.speed * 1.5 : plane.speed,
                                            }
                                        ]
                                    }))
                                },
                                options: {
                                    plugins: {
                                        colorschemes: {
                                            scheme: 'office.Celestial6'
                                        }
                                    },
                                    elements: {
                                        point: {
                                            pointStyle: "star"
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Speed to range',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                            fontSize: 13,
                                            usePointStyle: true
                                        }
                                    },
                                    scales: {
                                        yAxes: [
                                            {
                                                display: true,
                                                scaleLabel: {
                                                    display: true,
                                                    labelString: 'Speed',
                                                    fontColor: "#191",
                                                    fontFamily: "Mono",
                                                    fontSize: 20,
                                                    fontStyle: "bold",
                                                    padding: {
                                                        top: 20,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0
                                                    }
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    callback: (val: number) => `${val.toLocaleString('en')} km/h`
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                display: true,
                                                scaleLabel: {
                                                    display: true,
                                                    labelString: 'Range',
                                                    fontColor: "#191",
                                                    fontFamily: "Mono",
                                                    fontSize: 20,
                                                    fontStyle: "bold",
                                                    padding: {
                                                        top: 20,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0
                                                    }
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
                        title: "Plane comparing",
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
                case "settings": {
                    switch(subCommand) {
                        case "create": {
                            const owner = interaction.client.application.owner;
                            const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                            if (!isDeveloper && (!account || account.admin_level < 2)) {
                                const existing_settings = await planeSettings.countDocuments({ id: interaction.user.id });
                                if (existing_settings > 25) throw new DiscordClientError('You can only have 25 existing plane settings at a time!');
                            }
                            const planeName = interaction.options.getString("plane", true).trim();
                            const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeName));
                            if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
                            let options: Settings.Plane = {
                                id: interaction.user.id,
                                planeID: plane._id,
                                modifications: {
                                    fuel: interaction.options.getBoolean("fuel_modification", true),
                                    speed: interaction.options.getBoolean("speed_modification", true),
                                    co2: interaction.options.getBoolean("co2_modification", true)
                                }
                            };
                            const engineName = interaction.options.getString("engine")?.trim();
                            if (engineName) {
                                const engine = plane.engines.find(engine => engine.name.toLowerCase() === engineName.toLowerCase());
                                if (!engine) throw new DiscordClientError(`Invalid engine, the engines for ${Formatters.bold(plane.name)} are: ${plane.engines.map(engine => engine.name).join(", ")}`);
                                options.engine = engine.name;
                            }
                            await planeSettings.insertOne(options);
                            await interaction.editReply(`Created new settings for ${Formatters.bold(plane.name)}. To edit then use \`/plane settings edit\` and to delete them use \`/plane settings delete\`. To view your plane settings use \`/plane settings viewV.`);
                            break;
                        }
                        case "edit": {
                            const planeName = interaction.options.getString("plane", true).trim();
                            const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeName));
                            if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
                            const filter: Filter<Settings.Plane> = { 
                                id: interaction.user.id, 
                                planeID: plane._id 
                            };
                            const currentSettings = await planeSettings.findOne(filter, {
                                projection: {
                                    _id: true,
                                    engine: true,
                                    modifications: true
                                }
                            });
                            if (!currentSettings) throw new DiscordClientError(`You do not have any active settings for ${Formatters.bold(plane?.name || planeName)}. You can create settings by using \`/plane settings create\`.`);
                            const commandOptions = interaction.options.data.find(option => option.name === group).options.find(option => option.name === subCommand).options;
                            const modifications = commandOptions.filter(option => option.name.endsWith("modification"));
                            for (const option of modifications.values()) {
                                const [prop] = option.name.match(/fuel|co2|speed/);
                                currentSettings.modifications[prop] = option.value;
                            }
                            const engine_name = interaction.options.getString("engine")?.trim();
                            if (engine_name) {
                                const engine = plane.engines.find(engine => engine.name.toLowerCase() === engine_name.toLowerCase());
                                if (!engine) throw new DiscordClientError(`Invalid engine, the engines for ${Formatters.bold(plane.name)} are: ${plane.engines.map(engine => engine.name).join(", ")}`);
                                currentSettings.engine = engine.name;
                            }
                            await planeSettings.updateOne({ _id: currentSettings._id }, { $set: currentSettings });
                            await interaction.editReply(`Updated settings for ${Formatters.bold(plane.name)}!`);
                            break;
                        }
                        case "delete": {
                            const planeName = interaction.options.getString("plane", true).trim();
                            const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeName));
                            if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
                            const filter: Filter<Settings.Plane> = { 
                                id: interaction.user.id, 
                                planeID: plane._id 
                            };
                            const currentSettings = await planeSettings.findOne(filter, {
                                projection: {
                                    _id: true,
                                    engine: true,
                                    modifications: true
                                }
                            });
                            if (!currentSettings) throw new DiscordClientError(`You do not have any active settings for ${Formatters.bold(plane?.name || planeName)}. You can create settings by using \`/plane settings create\`.`);
                            const res = await planeSettings.deleteOne({ _id: currentSettings._id });
                            await interaction.editReply(res.deletedCount ? `Deleted the settings for ${Formatters.bold(plane.name)}!` : `You do not have any active settings for ${Formatters.bold(plane.name)}...`);
                            break;
                        }
                        case "view": {
                            const planeName = interaction.options.getString("plane", true).trim();
                            const plane = await planeCollection.findOne(createTextFilter<AM4.Plane>(planeName));
                            if (!plane) throw new DiscordClientError(`No plane was found with ${Formatters.bold(planeName)}...`);
                            const filter: Filter<Settings.Plane> = { 
                                id: interaction.user.id, 
                                planeID: plane._id 
                            };
                            const currentSettings = await planeSettings.findOne(filter, {
                                projection: {
                                    _id: false,
                                    engine: true,
                                    modifications: true
                                }
                            });
                            if (!currentSettings) throw new DiscordClientError(`You do not have any active settings for ${Formatters.bold(plane?.name || planeName)}. You can create settings by using \`/plane settings create\`.`);
                            const active = await planeSettings.countDocuments({ id: interaction.user.id });
                            const image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                            const embed = new MessageEmbed({
                                color: "GREYPLE",
                                title: `Settings for ${plane.name}`,
                                description: `**Fuel modification:** ${currentSettings.modifications.fuel}\n**Speed modification:** ${currentSettings.modifications.speed}\n**Co2 modification:** ${currentSettings.modifications.co2}\n**Engine:** ${currentSettings.engine || "none"}`,
                                image: {
                                    url: createAttachmentUrl(image)
                                },
                                author: {
                                    name: `${interaction.user.username}#${interaction.user.discriminator}`,
                                    iconURL: interaction.user.displayAvatarURL()
                                },
                                footer: {
                                    text: `${active}/25 active settings`,
                                    iconURL: interaction.client.user.displayAvatarURL()
                                }
                            });
                            await interaction.editReply({ 
                                embeds: [embed], 
                                files: [image] 
                            });
                            break;
                        }
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
        const planes = database.am4.collection<AM4.Plane>('Planes');
        const focused = interaction.options.getFocused(true);
        try {
            let choices: ApplicationCommandOptionChoice[];
            if (focused.name === "engine") {
                const planeName = interaction.options.getString("plane");
                if (planeName) {
                    const plane = await planes.findOne(createTextFilter<AM4.Plane>(planeName));
                    if (plane) {
                        choices = plane.engines.map(engine => ({
                            name: engine.name,
                            value: engine.name
                        }));
                    }
                }
            } else {
                const value = (<string>focused.value)?.slice(0, 15).match(/(\w|-|\s){1,}/g)?.join("");
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