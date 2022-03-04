import { Permissions, MessageEmbed, Formatters, Constants, MessageActionRow, MessageButton, type GuildMember, type RoleResolvable, type TextChannel } from 'discord.js';
import { Discord as Utils } from '../../utils';
import DiscordClientError from '../error';
import defaultSettings from '../../../src/settings.json';
import { emojis } from '../../../config.json';
import format from 'date-fns/format';

import type { Discord, Settings } from '@typings/database';
import type { SlashCommand } from '@discord/types';

const { formatSeats } = Utils;

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
        Permissions.FLAGS.MANAGE_NICKNAMES,
        Permissions.FLAGS.MANAGE_ROLES
    ]),
    data: {
        name: 'user',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage and view users',
        defaultPermission: true,
        options: [
            {
                name: 'login',
                description: "Login with your airline ID",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'id',
                        description: "The ID of your airline",
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        required: true
                    }
                ]
            },
            {
                name: 'logout',
                description: "Logout from your connected airline",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            },
            {
                name: 'sync',
                description: "Sync your airline name and game mode",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            },
            {
                name: 'view',
                description: "View your AM4 Bot user information",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            },
            {
                name: 'settings',
                description: 'Manage your personal settings',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'salaries',
                        description: 'Manage your salary settings',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'pilot',
                                description: "The pilot salary to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 200,
                                required: false
                            },
                            {
                                name: 'crew',
                                description: "The crew salary to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 150,
                                required: false
                            },
                            {
                                name: 'engineer',
                                description: "The engineer salary to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 250,
                                required: false
                            },
                            {
                                name: 'tech',
                                description: "The tech salary to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 225,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'training',
                        description: 'Manage your training settings',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'fuel',
                                description: "The fuel training to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 3,
                                required: false
                            },
                            {
                                name: 'co2',
                                description: "The co2 training to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 5,
                                required: false
                            },
                            {
                                name: 'cargo_heavy',
                                description: "The cargo heavy training to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 6,
                                required: false
                            },
                            {
                                name: 'cargo_large',
                                description: "The cargo large training to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 6,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'preference',
                        description: 'Manage your configuration preference settings',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'pax',
                                description: "Pax and VIP plane configuration preference to use in configuration",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false,
                                choices: [
                                    {
                                        name: 'Default',
                                        value: 'default'
                                    },
                                    {
                                        name: 'F > J > Y',
                                        value: 'FJY'
                                    },
                                    {
                                        name: 'F > Y > J',
                                        value: 'FYJ'
                                    },
                                    {
                                        name: 'J > F > Y',
                                        value: 'JFY'
                                    },
                                    {
                                        name: 'J > Y > F',
                                        value: 'JYF'
                                    },
                                    {
                                        name: 'Y > J > F',
                                        value: 'YJF'
                                    },
                                    {
                                        name: 'Y > F > J',
                                        value: 'YFJ'
                                    }
                                ]
                            },
                            {
                                name: 'cargo',
                                description: "Cargo plane configuration preference to use in configuration",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false,
                                choices: [
                                    {
                                        name: 'Default',
                                        value: 'default'
                                    },
                                    {
                                        name: 'L > H',
                                        value: 'LH'
                                    },
                                    {
                                        name: 'H > L',
                                        value: 'HL'
                                    }
                                ]
                            },
                        ]
                    },
                    {
                        name: 'options',
                        description: 'Manage your general options for AM4 Bot',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'fuel_price',
                                description: "The fuel price to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 3000,
                                required: false
                            },
                            {
                                name: 'co2_price',
                                description: "The co2 price to use in calculations",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 200,
                                required: false
                            },
                            {
                                name: 'activity',
                                description: "The activity time of your airline per day (in hours)",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 24,
                                required: false
                            },
                            {
                                name: 'cost_index',
                                description: "The default cost index to use on route commands",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 200,
                                required: false
                            },
                            {
                                name: 'code',
                                description: "Whether to show results with ICAO or IATA codes. By default displays both.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false,
                                choices: [
                                    {
                                        name: 'Both',
                                        value: 'default'
                                    },
                                    {
                                        name: 'ICAO',
                                        value: 'icao'
                                    },
                                    {
                                        name: 'IATA',
                                        value: 'iata'
                                    }
                                ]
                            },
                            {
                                name: 'show_warnings',
                                description: "Whether to receive warnings after a command if there are any. Disabling this is not recommended.",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'show_tips',
                                description: "Whether to receive tips after a command if there are any.",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            }
                        ]
                    },
                    {
                        name: "view",
                        description: "View your current settings",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, account, rest, locale }) {
        await interaction.deferReply({ ephemeral: interaction.inGuild() });
        try {
            const users = database.discord.collection<Discord.User>('Users');
            const settings = database.settings.collection<Settings.User>('Users');
            const servers = database.settings.collection<Settings.Server>('Servers');
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "settings": {
                    switch(subCommand) {
                        case "view": {
                            const userSettings = await settings.findOne({ id: interaction.user.id });
                            if (!userSettings) throw new DiscordClientError("You do not have any settings saved...");
                            const { salaries, training, preference, options } = userSettings;
                            const embed = new MessageEmbed({
                                color: "GREYPLE",
                                thumbnail: {
                                    url: "https://i.ibb.co/d4WM0xc/maint.png"
                                },
                                author: {
                                    name: `${interaction.user.username}#${interaction.user.discriminator}`,
                                    iconURL: interaction.user.displayAvatarURL()
                                },
                                footer: {
                                    text: `User ID: ${interaction.user.id}`,
                                    iconURL: interaction.client.user.displayAvatarURL()
                                },
                                fields: [
                                    { 
                                        name: Formatters.bold(Formatters.underscore("Salaries")), 
                                        value: `${Formatters.formatEmoji(emojis.pilots)} $${salaries.pilot.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.crew)} $${salaries.crew.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.engineer)} $${salaries.tech.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.tech)} $${salaries.tech.toLocaleString(locale)}`, 
                                        inline: true 
                                    },
                                    { 
                                        name: Formatters.bold(Formatters.underscore("Training")), 
                                        value: `${Formatters.formatEmoji(emojis.co2_reduce)} -${training.co2}%\n${Formatters.formatEmoji(emojis.fuel_reduce)} -${training.fuel}%\n${Formatters.formatEmoji(emojis.cargo_big)} +${training.cargo_heavy}%\n${Formatters.formatEmoji(emojis.cargo_small)} +${training.cargo_large}%`, 
                                        inline: true 
                                    },
                                    { 
                                        name: Formatters.bold(Formatters.underscore("Preference")), 
                                        value: `**Pax:** ${preference.pax ? formatSeats(preference.pax.join(' > ')) : 'default'}\n**Cargo:** ${preference.cargo ? formatSeats(preference.cargo.join(' > ')) : 'default'}`, 
                                        inline: false 
                                    },
                                    { 
                                        name: Formatters.bold(Formatters.underscore("Options")), 
                                        value: `**Cost index:** ${options.cost_index}\n**Fuel price:** $${options.fuel_price.toLocaleString(locale)}\n**Co2 price:** $${options.co2_price.toLocaleString(locale)}\n**Activity:** ${options.activity}h/day\n**Code type:** ${options.code || 'default'}\n**Show warnings:** ${options.show_warnings}\n**Show tips:** ${options.show_tips}`, 
                                        inline: true 
                                    }
                                ]
                            });
                            if (interaction.inCachedGuild()) embed.setColor(interaction.member.displayColor);
                            await interaction.editReply({ embeds: [embed] });
                            break;
                        }
                        default: {
                            const options = interaction.options.data[0].options[0].options;
                            if (!options?.length) throw new DiscordClientError("You need to fill in atleast one option to edit!");
                            const user = await settings.findOne({ id: interaction.user.id });
                            if (!user) await settings.insertOne({
                                id: interaction.user.id,
                                salaries: defaultSettings.salaries,
                                training: {
                                    cargo_heavy: 0,
                                    cargo_large: 0,
                                    fuel: 0,
                                    co2: 0
                                },
                                preference: {
                                    cargo: undefined,
                                    pax: undefined
                                },
                                options: {
                                    activity: defaultSettings.activity,
                                    fuel_price: defaultSettings.fuelPrice,
                                    co2_price: defaultSettings.co2Price,
                                    show_warnings: true,
                                    show_tips: false,
                                    cost_index: 200,
                                    code: undefined
                                }
                            });
                            const update: { [key: string]: any } = {};
                            for (const option of options) {
                                let value: unknown;
                                if (option.type === "STRING") {
                                    value = (<string>option.value).trimEnd();
                                    if (subCommand === 'preference') value = (<string>value).split("");
                                    if (option.value === 'default') value = undefined;
                                } else {
                                    value = option.value;
                                }
                                update[`${subCommand}.${option.name}`] = value;
                            }
                            const res = await settings.updateOne({ id: interaction.user.id }, { $set: update });
                            if (!res.acknowledged || !res.modifiedCount) throw new DiscordClientError("Failed to update your settings...");
                            await interaction.editReply('Your settings have been updated!');
                            break;
                        }
                    }
                    break;
                }
                case "view": {
                    const userData = await users.findOne({ id: interaction.user.id });
                    const userSettings = await settings.findOne({ id: interaction.user.id });
                    const commands = userData.commands.sort((a, b) => b.uses - a.uses).slice(0, 10);
                    const embed = new MessageEmbed({
                        color: "GREYPLE",
                        description: `**Game mode:** ${userSettings?.mode || "unknown"}\n**Airline ID:** ${userData?.airlineID || 'unknown'}\n**Airline name:** ${userData?.name || "unknown"}\n**Notifications made:** ${userData?.notifications_made}`,
                        timestamp: userData._id.getTimestamp(),
                        author: {
                            name: `${interaction.user.username}#${interaction.user.discriminator}`,
                            iconURL: interaction.user.displayAvatarURL()
                        },
                        footer: {
                            text: `User ID: ${interaction.user.id}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        },
                        fields: [
                            {
                                name: Formatters.bold(Formatters.underscore("Most used commands")),
                                value: Formatters.codeBlock(commands.map(({ command, uses }, i) => `${i + 1}. ${command} ► ${uses.toLocaleString(locale)}`).join('\n')),
                                inline: true
                            }
                        ]
                    });
                    if (interaction.inCachedGuild()) embed.setColor(interaction.member.displayColor);
                    if (userData.mute) embed.author.name += " (suspended)";
                    if (userData.warnings.length) embed.addFields({
                        name: Formatters.bold(Formatters.underscore(`Warnings (${userData.warnings.length}/5)`)),
                        value: Formatters.codeBlock(userData.warnings.map(warning => `${format(warning.date, 'dd/MM/yyyy')} ► ${warning.reason}`).join("\n")),
                        inline: true
                    });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case "login": {
                    if (account?.airlineID) throw new DiscordClientError('You have already logged in. If you want to change your airline use `/user logout` and then login again.');
                    const airlineID = interaction.options.getInteger("id", true);
                    const loggedIn = await users.countDocuments({ airline_id: airlineID });
                    if (loggedIn) throw new DiscordClientError('Someone has already logged in with this airline ID. If you are sure that this is your airline contact us! Impersonating another airline may result in suspension from using AM4 Bot!');
                    const { status, airline } = await rest.fetchAirline(airlineID);
                    if (!status.success) throw new DiscordClientError(status.error);
                    const res = await users.updateOne({ id: interaction.user.id }, {
                        $setOnInsert: {
                            admin_level: 0,
                            notifications_made: 0,
                            commands: [],
                            warnings: []
                        },
                        $set: {
                            name: airline.name,
                            airlineID: airlineID
                        }
                    });
                    if (!res.acknowledged || !res.modifiedCount) throw new DiscordClientError("Failed to register your account. Please try again...");
                    await settings.updateOne(
                        { 
                            id: interaction.user.id 
                        }, 
                        {
                            $setOnInsert: {
                                training: {
                                    fuel: 0,
                                    co2: 0,
                                    cargo_heavy: 0,
                                    cargo_large: 0
                                },
                                salaries: {
                                    pilot: 200,
                                    crew: 150,
                                    engineer: 250,
                                    tech: 225
                                },
                                preference: {
                                    pax: undefined,
                                    cargo: undefined
                                },
                                options: {
                                    show_warnings: true,
                                    show_tips: false,
                                    cost_index: 200,
                                    activity: 18,
                                    code: undefined,
                                    fuel_price: 500,
                                    co2_price: 125
                                }
                            },
                            $set: {
                                mode: airline.gameMode
                            }
                        }, 
                        { 
                            upsert: true 
                        }
                    );
                    if (interaction.guild) {
                        const server = await servers.findOne({ id: interaction.guildId });
                        const member = <GuildMember>interaction.member;
                        if (server) {
                            if (server.update_nickname && member.manageable) await member.setNickname(airline.name, `Logged in as ${airline.name}`);
                            if (server.update_roles) {
                                const roles = new Set<RoleResolvable>();
                                if (server.roles.default) roles.add(server.roles.default);
                                if (airline.alliance && server.roles.member && server.alliance_name) {
                                    const isAllianceMember = airline.alliance.name === server.alliance_name;
                                    if (isAllianceMember) {
                                        roles.add(server.roles.member);
                                    } else if (member.roles.cache.has(server.roles.member)) {
                                        await member.roles.remove(server.roles.member, "Not an alliance member");
                                    }
                                }
                                const gameMode = airline.gameMode.toLowerCase() as Lowercase<typeof airline.gameMode>;
                                if (gameMode in server.roles) roles.add(server.roles[gameMode]);
                                if (roles.size) await member.roles.add([...roles], `Logged in as ${airline.name}`).catch(() => void 0);
                            }
                            if (server.log_channel) {
                                await interaction.guild.channels.fetch(server.log_channel)
                                .then(async (logChannel: TextChannel) => {
                                    const permissions = logChannel.permissionsFor(interaction.guild.me);
                                    if (permissions.has("SEND_MESSAGES")) {
                                        const row = new MessageActionRow({
                                            components: [
                                                new MessageButton({
                                                    customId: `airline:${airlineID}`,
                                                    label: "Search airline",
                                                    style: "SECONDARY",
                                                    emoji: "🔎"
                                                })
                                            ]
                                        });
                                        await logChannel.send({
                                            content: `${Formatters.userMention(interaction.user.id)} has logged in as ${Formatters.bold(airline.name)} in ${Formatters.channelMention(interaction.channelId)}.`,
                                            components: [row]
                                        });
                                    } else {
                                        await servers.updateOne({ _id: server._id }, {
                                            $unset: {
                                                log_channel: ""
                                            }
                                        });
                                    }
                                })
                                .catch(async err => {
                                    console.error("Error while fetching a log channel:", err);
                                    await servers.updateOne({ _id: server._id }, {
                                        $unset: {
                                            log_channel: ""
                                        }
                                    });
                                });
                            }
                        }
                    }
                    await interaction.editReply(`You have logged in as ${Formatters.bold(airline.name)}. If you change your game mode use \`/user sync\`. To logout from this airline use \`/user logout\`.`);
                    break;
                }
                case "logout": {
                    if (!account?.airlineID) throw new DiscordClientError("You have not logged in. To login use `/user login`.");
                    await users.updateOne({ _id: account._id }, {
                        $unset: {
                            airlineID: "",
                            name: ""
                        }
                    });
                    await settings.updateOne({ id: interaction.user.id }, {
                        $unset: {
                            mode: ""
                        }
                    });
                    if (interaction.guild) {
                        const server = await servers.findOne({ id: interaction.guild.id });
                        const member = <GuildMember>interaction.member;
                        if (server) {
                            if (server.update_nickname && member.manageable) await member.setNickname(null, `Logged out from ${account.name}`);
                            if (server.update_roles) {
                                const roles = new Set<RoleResolvable>();
                                for (const role in server.roles) {
                                    const roleId = server.roles[role];
                                    if (roleId) roles.add(roleId);
                                }
                                if (roles.size) await member.roles.remove([...roles], `Logged out from ${account.name}`).catch(() => void 0);
                            }
                            if (server.log_channel) {
                                await interaction.guild.channels.fetch(server.log_channel)
                                .then(async (logChannel: TextChannel) => {
                                    const permissions = logChannel.permissionsFor(interaction.guild.me);
                                    if (permissions.has("SEND_MESSAGES")) {
                                        const row = new MessageActionRow({
                                            components: [
                                                new MessageButton({
                                                    customId: `airline:${account.airlineID}`,
                                                    label: "Search airline",
                                                    style: "SECONDARY",
                                                    emoji: "🔎"
                                                })
                                            ]
                                        });
                                        await logChannel.send({
                                            content: `${Formatters.userMention(interaction.user.id)} has logged out from ${Formatters.bold(account.name)}...`,
                                            components: [row]
                                        });
                                    } else {
                                        await servers.updateOne({ _id: server._id }, {
                                            $unset: {
                                                log_channel: ""
                                            }
                                        });
                                    }
                                })
                                .catch(async err => {
                                    console.error("Error while fetching a log channel:", err);
                                    await servers.updateOne({ _id: server._id }, {
                                        $unset: {
                                            log_channel: ""
                                        }
                                    });
                                });
                            }
                        }
                    }
                    await interaction.editReply(`Logged out from ${Formatters.bold(account.name)} - to login again use \`/user login\`.`);
                    break;
                }
                case "sync": {
                    if (!account?.airlineID) throw new DiscordClientError("You have not logged in. To login use `/user login`.");
                    const { status, airline } = await rest.fetchAirline(account.airlineID);
                    if (!status.success) throw new DiscordClientError(status.error);
                    await settings.updateOne({ id: interaction.user.id }, {
                        $set: {
                            mode: airline.gameMode
                        }
                    });
                    await users.updateOne({ id: interaction.user.id }, {
                        $set: {
                            name: airline.name
                        }
                    });
                    if (interaction.guild) {
                        const member = <GuildMember>interaction.member;
                        const server = await servers.findOne({ id: interaction.guild.id });
                        if (server && (server.update_nickname || server.update_roles)) {
                            if (server.update_nickname) await member.setNickname(airline.name, `Updating the nickname of ${airline.name}`);
                            if (server.update_roles) {
                                const addRoles = new Set<RoleResolvable>();
                                const removeRoles = new Set<RoleResolvable>();
                                if (server.roles.default && !member.roles.cache.has(server.roles.default)) addRoles.add(server.roles.default);
                                if (server.roles.member && server.alliance_name) {
                                    if (member.roles.cache.has(server.roles.member)) {
                                        if (airline.alliance) {
                                            const isAllianceMember = airline.alliance.name === server.alliance_name;
                                            if (!isAllianceMember) removeRoles.add(server.roles.member);
                                        } else {
                                            removeRoles.add(server.roles.member);
                                        }
                                    } else if (airline.alliance) {
                                        const isAllianceMember = airline.alliance.name === server.alliance_name;
                                        if (isAllianceMember) addRoles.add(server.roles.member);
                                    }
                                }
                                switch(airline.gameMode) {
                                    case "Realism": {
                                        if (!server.roles.realism) break;
                                        if (!member.roles.cache.has(server.roles.realism)) addRoles.add(server.roles.realism);
                                        break;
                                    }
                                    case "Easy": {
                                        if (!server.roles.easy) break;
                                        if (server.roles.realism && member.roles.cache.has(server.roles.realism)) removeRoles.add(server.roles.realism);
                                        if (!member.roles.cache.has(server.roles.easy)) addRoles.add(server.roles.easy);
                                        break;
                                    }
                                }
                                if (addRoles.size) await member.roles.add([...addRoles], `Updating the roles of ${airline.name}`).catch(() => void 0);
                                if (removeRoles.size) await member.roles.remove([...removeRoles], `Updating the roles of ${airline.name}`).catch(() => void 0);
                            }
                        }
                    }
                    await interaction.editReply("Your airline and game mode have been updated up to date!");
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
    }
}

export = command;