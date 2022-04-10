import { Permissions, MessageEmbed, Formatters, MessageButton, MessageActionRow, Role, Constants, type TextChannel, type Webhook } from 'discord.js';
import DiscordClientError from '../error';
import CryptoJS from 'crypto-js';

import type { SlashCommand } from '@discord/types';
import type { Settings } from '@typings/database';

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isGlobal: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.ATTACH_FILES,
        Permissions.FLAGS.MANAGE_WEBHOOKS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.MANAGE_ROLES
    ]),
    data: {
        name: 'settings',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage server settings',
        defaultPermission: false,
        options: [
            {
                name: 'view',
                description: "View this server's settings",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            },
            {
                name: 'login',
                description: 'Manage login settings for this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: "set",
                        description: "Set the login settings for this server",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "update_nickname",
                                description: "Whether to update a user's nickname when the user logs in",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: "update_roles",
                                description: "Whether to update a user's roles when the user logs in",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: "alliance_name",
                                description: "The name of this server's alliance. Will be used for assigning member role.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: "log_channel",
                                description: "The channel to log logins and logouts. If not specified will not be logged.",
                                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                                channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                                required: false
                            }
                        ]
                    },
                    {
                        name: "reset",
                        description: "Reset the login settings for this server",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "alliance_name",
                                description: "Whether to reset the alliance name of this server",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: "log_channel",
                                description: "Whether to reset the log channel of this server",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            }
                        ]
                    }
                ]
            },
            {
                name: 'roles',
                description: 'Manage server role settings',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: "set",
                        description: "Set this server's role settings",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'default',
                                description: 'The default role to give after login',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: false
                            },
                            {
                                name: 'easy',
                                description: 'The easy role of this server',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: false
                            },
                            {
                                name: 'realism',
                                description: 'The realism role of this server',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: false
                            },
                            {
                                name: 'member',
                                description: 'The alliance member role of this server',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: false
                            }
                        ]
                    },
                    {
                        name: "reset",
                        description: "Reset this server's role settings",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'default',
                                description: 'Whether to reset the default role',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: true
                            },
                            {
                                name: 'easy',
                                description: 'Whether to reset the easy role',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'realism',
                                description: 'Whether to reset the realism role',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'member',
                                description: 'Whether to reset member role',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            }
                        ]
                    }
                ]
            },
            {
                name: 'permissions',
                description: "Manage command permissions for this server",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'add',
                        description: "Add a new permission overwrite to a command",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "command",
                                description: "The ID of the command that you wan to view. See /help for a full list of command IDs.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "mentionable",
                                description: "The ID or mention of the role or user",
                                type: Constants.ApplicationCommandOptionTypes.MENTIONABLE,
                                required: true
                            },
                            {
                                name: "permission",
                                description: "Whether this user can use the command or not",
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'remove',
                        description: "Remove a permission overwrite from a command",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "command",
                                description: "The ID of the command that you wan to view. See /help for a full list of command IDs.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "mentionable",
                                description: "The ID or mention of the role or user",
                                type: Constants.ApplicationCommandOptionTypes.MENTIONABLE,
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'clear',
                        description: "Clear all permission overwrites from a command",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "command",
                                description: "The ID of the command that you wan to view. See /help for a full list of command IDs.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'view',
                        description: "View permission overwrites of a command",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "command",
                                description: "The ID of the command that you wan to view. See /help for a full list of command IDs.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            }
                        ]
                    }
                ]
            },
            {
                name: 'webhooks',
                description: 'Manage notification webhooks of this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'create',
                        description: 'Create a new notification webhook to this server',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'channel',
                                description: 'The channel of this notification webhook',
                                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                                channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                                required: true
                            },
                            {
                                name: 'role',
                                description: 'The role to ping on the notifications',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: true
                            },
                            {
                                name: 'fuel',
                                description: 'Whether this webhook will send fuel notifications',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'co2',
                                description: 'Whether this webhook will send co2 notifications',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: true
                            },
                            {
                                name: 'max_fuel',
                                description: 'The maximum fuel price to send. By default 1000.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 3000,
                                required: false
                            },
                            {
                                name: 'max_co2',
                                description: 'The maximum co2 price to send. By default 150.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 0,
                                maxValue: 200,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'edit',
                        description: 'Edit an existing notification webhook',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'id',
                                description: 'The id of the notification webhook',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: 'role',
                                description: 'The fuel notification role',
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: false
                            },
                            {
                                name: 'fuel',
                                description: 'Whether this webhook will send fuel notifications',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'co2',
                                description: 'Whether this webhook will send co2 notifications',
                                type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                                required: false
                            },
                            {
                                name: 'max_fuel',
                                description: 'The maximum fuel price to send. By default 1000.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 3000,
                                required: false
                            },
                            {
                                name: 'max_co2',
                                description: 'The maximum co2 price to send. By default 150.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 200,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'delete',
                        description: 'Delete a notification webhook from this server',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'id',
                                description: 'The ID of the notification webhook',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            }
                        ]
                    },
                    {
                        name: 'view',
                        description: 'View all notification webhooks of this server',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
                    }
                ]
            },
            {
                name: "channels",
                description: "Manage channel settings for this server",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: "add",
                        description: "Add a channel to command blacklist/whitelist",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "channel",
                                description: "The channel to add",
                                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                                channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                                required: true
                            },
                            {
                                name: "list",
                                description: "Whether to add this channel to the blacklist or whitelist",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true,
                                choices: [
                                    {
                                        name: "Blacklist",
                                        value: "blacklist"
                                    },
                                    {
                                        name: "Whitelist",
                                        value: "whitelist"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "remove",
                        description: "Remove a channel from command blacklist/whitelist",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "channel",
                                description: "The channel to remove",
                                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                                channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                                required: true
                            },
                            {
                                name: "list",
                                description: "Whether to remove this channel from the blacklist or whitelist",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true,
                                choices: [
                                    {
                                        name: "Blacklist",
                                        value: "blacklist"
                                    },
                                    {
                                        name: "Whitelist",
                                        value: "whitelist"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: "reset",
                        description: "Reset channel whitelist and blacklist",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, rest, guildLocale }) {
        if (!interaction.inGuild() as boolean) {
            await interaction.reply("This command can only be used in servers...");
            return;
        } else if (!interaction.inCachedGuild()) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const servers = database.settings.collection<Settings.Server>('Servers');
            const server = await servers.findOne({ id: interaction.guild.id });
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "roles": {
                    type UpdateType<T> = { [key: string]: T };
                    let update: UpdateType<string> = {}, ok: boolean | number;
                    switch(subCommand) {
                        case "set": {
                            const options = interaction.options.data[0].options[0].options;
                            if (!options?.length) throw new DiscordClientError("You need to define atleast one of the options...");
                            const highest = interaction.guild.me.roles.highest.position;
                            for (const option of options) {
                                if (option.role.position > highest) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} The role needs to be lower in the hierarchy than the bot's highest ranked role!`);
                                update[`roles.${option.name}`] = option.role.id;
                            }
                            const res = await servers.updateOne(
                                { 
                                    id: interaction.guildId 
                                }, 
                                {
                                    $set: update,
                                    $setOnInsert: {
                                        update_nickname: false,
                                        update_roles: false,
                                        channels: {
                                            whitelist: [],
                                            blacklist: []
                                        }
                                    }
                                }, 
                                { 
                                    upsert: true 
                                }
                            );
                            ok = res.acknowledged && (res.modifiedCount || res.upsertedCount);
                            break;
                        }
                        case "reset": {
                            const options = interaction.options.data[0].options[0].options;
                            for (const option of options) update[`roles.${option.name}`] = "";
                            const res = await servers.updateOne({ id: interaction.guildId }, { $unset: <UpdateType<"">>update });
                            ok = res.acknowledged && (res.modifiedCount || res.upsertedCount);
                            break;
                        }
                    }
                    const inviteUrl = process.env.DISCORD_SERVER_INVITE;
                    if (inviteUrl === undefined) throw new Error("DISCORD_SERVER_INVITE must be provided!");
                    await interaction.editReply(ok ? "The role settings of this server have been updated." : `Failed to update the role settings of this server. Please try again or report this in ${inviteUrl}.`);
                    break;
                }
                case "permissions": {
                    const commandId = interaction.options.getString("command", true).trim();
                    await interaction.client.application.commands.fetch(commandId)
                    .then(async command => {
                        if (command.id === interaction.commandId && !interaction.member.permissions.has("ADMINISTRATOR")) throw new DiscordClientError("Only administrators can edit the permissions of this command!");
                        switch(subCommand) {
                            case "add": {
                                const mentionable = interaction.options.get("mentionable", true);
                                const permissions = await command.permissions.fetch({ guild: interaction.guildId });
                                if (permissions.length === 10) throw new DiscordClientError("That command has the maximum amount of permission overwrites. You need to remove some existing permission overwrites to add more.");
                                const roleOrUser = mentionable.user || mentionable.role;
                                await command.permissions.add({
                                    guild: interaction.guildId,
                                    permissions: [{
                                        id: roleOrUser.id,
                                        type: roleOrUser instanceof Role ? "ROLE" : "USER",
                                        permission: interaction.options.getBoolean("permission", true)
                                    }]
                                });
                                await interaction.editReply(`The permissions of ${Formatters.bold(command.name)} have been updated. The command currently has ${Formatters.bold(`${permissions.length}/10`)} active permission overwrites.`);
                                break;
                            }
                            case "remove": {
                                const mentionable = interaction.options.get("mentionable", true);
                                if (!mentionable.role && !mentionable.user) throw new DiscordClientError("The mentionable needs to either be a user or a role!");
                                const permissions = await command.permissions.remove({
                                    guild: interaction.guildId,
                                    roles: mentionable.role?.id,
                                    users: mentionable.user?.id
                                });
                                await interaction.editReply(`The permissions of ${Formatters.bold(command.name)} have been updated. The command currently has ${Formatters.bold(`${permissions.length}/10`)} active permission overwrites.`);
                                break;
                            }
                            case "clear": {
                                if (interaction.user.id !== interaction.guild.ownerId) throw new DiscordClientError("Only the owner of this server can clear permission overwrites of a command!");
                                await command.permissions.set({
                                    guild: interaction.guildId,
                                    permissions: [{
                                        id: interaction.guild.ownerId, 
                                        type: "USER", 
                                        permission: true,
                                    }]
                                });
                                await interaction.editReply(`The permissions of ${Formatters.bold(command.name)} have been cleared. Only the owner of the server can use this command until more permissions are added!`);
                                break;
                            }
                            case "view": {
                                const permissions = await command.permissions.fetch({ guild: interaction.guildId });
                                if (!permissions.length) throw new DiscordClientError("This command does not have any active permission overwrites...");
                                const embed = new MessageEmbed({
                                    color: "GREYPLE",
                                    title: `/${command.name}`,
                                    description: `**Default permission:** ${command.defaultPermission}\n**Permissions:** ${permissions.length}/10`,
                                    timestamp: command.createdTimestamp,
                                    thumbnail: {
                                        url: interaction.guild.iconURL()
                                    },
                                    footer: {
                                        text: `Command ID: ${command.id}`,
                                        iconURL: interaction.client.user.displayAvatarURL()
                                    }
                                });
                                const user_permissions = permissions.filter(permission => permission.type === "USER");
                                const role_permissions = permissions.filter(permission => permission.type === "ROLE");
                                if (user_permissions.length) embed.addFields({
                                    name: Formatters.bold(Formatters.underscore("User Permission")),
                                    value: user_permissions.map(({ id: user_id, permission }) => `${permission ? "✅" : "⛔"} <@${user_id}>`).join("\n"),
                                    inline: true
                                });
                                if (role_permissions.length) embed.addFields({
                                    name: Formatters.bold(Formatters.underscore("User Permission")),
                                    value: role_permissions.map(({ id: role_id, permission }) => `${permission ? "✅" : "⛔"} <@&${role_id}>`).join("\n"),
                                    inline: true
                                });
                                await interaction.editReply({ embeds: [embed] });
                                break;
                            }
                        }
                    })
                    .catch(async () => {
                        await interaction.editReply("That is not a valid command ID. For a list of all command IDs use `/help` and go to the commands section.");
                    });
                    break;
                }
                case "webhooks": {
                    const webhookCollection = database.settings.collection<Settings.Webhook>("Webhooks");
                    switch(subCommand) {
                        case "create": {
                            const current = await webhookCollection.countDocuments({ server: interaction.guildId });
                            if (current > 2) throw new DiscordClientError("A server can at most have 2 notification webhooks!");
                            const channel = <TextChannel>interaction.options.getChannel("channel", true);
                            const role = interaction.options.getRole("role", true);
                            if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("The role to mention needs to be lower than the bot's highest role!");
                            const fuel = interaction.options.getBoolean("fuel", true);
                            const co2 = interaction.options.getBoolean("co2", true);
                            const max_fuel = interaction.options.getInteger("max_fuel") ?? 1000;
                            const max_co2 = interaction.options.getInteger("max_co2") ?? 150;
                            const webhook = await channel.createWebhook(`${interaction.client.user.username} Notifications`, {
                                avatar: interaction.client.user.displayAvatarURL(),
                                reason: `Notification webhook created by ${interaction.user.username}#${interaction.user.discriminator}`,
                            });
                            const key = process.env.HASH_SECRET;
                            if (key === undefined) throw new Error("HASH_SECRET must be provided!");
                            const encrypted = CryptoJS.AES.encrypt(webhook.token, key);
                            await webhookCollection.insertOne({
                                id: webhook.id,
                                token: encrypted.toString(),
                                server: interaction.guild.id,
                                channel: channel.id,
                                role: role.id,
                                fuel: {
                                    enabled: fuel,
                                    max: max_fuel
                                },
                                co2: {
                                    enabled: co2,
                                    max: max_co2
                                }
                            });
                            const commands = await interaction.client.application.commands.fetch();
                            const fuelChatCommand = commands.find(command => command.name === "notification");
                            await fuelChatCommand.permissions.add({
                                guild: interaction.guildId,
                                permissions: [{
                                    id: role.id,
                                    type: "ROLE",
                                    permission: true
                                }]
                            });
                            await interaction.editReply(`A new notification webhook has been created. The ID of the webhook is ${Formatters.bold(webhook.id)}. You can use that to edit it or delete it with \`/settings webhooks edit\` and \`/settings webhooks delete\`.`);
                            break;
                        }
                        case "edit": {
                            const webhookId = interaction.options.getString("id", true).trim();
                            const webhook = await webhookCollection.findOne(
                                { 
                                    id: webhookId, 
                                    server: interaction.guild.id 
                                }, 
                                {
                                    projection: {
                                        _id: true,
                                        role: true,
                                        fuel: true,
                                        co2: true
                                    }
                                }
                            );
                            if (!webhook) throw new DiscordClientError("Could not find a notification webhook with that ID...");
                            const role = interaction.options.getRole("role");
                            if (role) {
                                if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("The role to mention needs to be lower than the bot's highest role!");
                                const commands = await interaction.client.application.commands.fetch();
                                const fuel_command = commands.find(command => command.name === "notification");
                                await fuel_command.permissions.remove({
                                    guild: interaction.guildId,
                                    roles: webhook.role
                                });
                                await fuel_command.permissions.add({
                                    guild: interaction.guildId,
                                    permissions: [{
                                        id: role.id,
                                        type: "ROLE",
                                        permission: true
                                    }]
                                });
                                webhook.role = role.id;
                            }
                            const max_fuel = interaction.options.getInteger("max_fuel");
                            if (max_fuel) webhook.fuel.max = max_fuel;
                            const max_co2 = interaction.options.getInteger("max_co2");
                            if (max_co2) webhook.co2.max = max_co2;
                            const fuel = interaction.options.getBoolean("fuel");
                            if (typeof fuel === "boolean") webhook.fuel.enabled = fuel;
                            const co2 = interaction.options.getBoolean("co2");
                            if (typeof co2 === "boolean") webhook.co2.enabled = co2;
                            await webhookCollection.updateOne({ _id: webhook._id }, { $set: webhook });
                            await interaction.editReply("The notification webhook has been updated!");
                            break;
                        }
                        case "delete": {
                            const webhookId = interaction.options.getString("id", true).trim();
                            const res = await webhookCollection.findOneAndDelete({ id: webhookId, server: interaction.guild.id });
                            if (!res.ok) throw new DiscordClientError("Could not delete a notification webhook with that ID...");
                            const webhook = await interaction.client.fetchWebhook(webhookId).catch(() => void 0) as Webhook;
                            if (webhook) await webhook.delete(`Notification webhook deleted by ${interaction.user.username}#${interaction.user.discriminator}`);
                            await interaction.editReply("The notification webhook has been deleted!");
                            const commands = await interaction.client.application.commands.fetch();
                            const fuel_command = commands.find(command => command.name === "notification");
                            await fuel_command.permissions.remove({
                                guild: interaction.guildId,
                                roles: res.value.role
                            });
                            break;
                        }
                        case "view": {
                            const webhooks = await webhookCollection.find({ server: interaction.guildId }).toArray();
                            if (!webhooks.length) throw new DiscordClientError("Could not find any notification webhooks in your server...");
                            const webhookClients = await interaction.guild.fetchWebhooks();
                            const embeds = webhooks.map(webhook => {
                                const webhookClient = webhookClients.find(client => client.id === webhook.id);
                                return new MessageEmbed({
                                    color: 1752220,
                                    description: `**Fuel notifications:** ${webhook.fuel.enabled}\n**Co2 notifications:** ${webhook.co2.enabled}`,
                                    footer: {
                                        text: `Webhook ID: ${webhookClient.id}`,
                                        iconURL: interaction.client.user.displayAvatarURL()
                                    },
                                    author: {
                                        name: webhookClient.name,
                                        iconURL: webhookClient.avatarURL()
                                    },
                                    fields: [
                                        {
                                            name: Formatters.bold(Formatters.underscore("Options")),
                                            value: `**Max fuel:** $${webhook.fuel.max.toLocaleString(guildLocale)}\n**Max co2:** $${webhook.co2.max.toLocaleString(guildLocale)}\n**Channel:** <#${webhook.channel}>\n**Role:** <@&${webhook.role}>\n**Server:** ${interaction.guild.name}`
                                        }
                                    ]
                                });
                            })
                            const pages = embeds.toGenerator();
                            let current_page = pages.next(1).value;
                            const components = [
                                new MessageActionRow({
                                    components: [
                                        new MessageButton({
                                            style: "PRIMARY",
                                            customId: "prev",
                                            emoji: "⬅️",
                                            disabled: embeds.length < 2
                                        }),
                                        new MessageButton({
                                            style: "PRIMARY",
                                            customId: "next",
                                            emoji: "➡️",
                                            disabled: embeds.length < 2
                                        })
                                    ]
                                })
                            ];
                            const message = await interaction.editReply({ embeds: [current_page], components });
                            if (embeds.length > 1) {
                                const collector = message.createMessageComponentCollector({ 
                                    filter: ({ user }) => user.id === interaction.user.id, 
                                    idle: 10 * 60 * 1000,
                                    componentType: "BUTTON"
                                });
                                collector.on("collect", async interaction => {
                                    current_page = pages.next(interaction.customId === "prev" ? -1 : 1).value;
                                    await interaction.update({ embeds: [current_page] });
                                });
                                collector.once('end', async collected => {
                                    const reply = collected.last() || interaction;
                                    for (const row of components) row.components.forEach(component => component.setDisabled(true));
                                    await reply.editReply({ components }).catch(() => void 0);
                                });
                            }
                            break;
                        }
                    }
                    break;
                }
                case "channels": {
                    type ChannelListType = "whitelist" | "blacklist";
                    switch(subCommand) {
                        case "add": {
                            const channel = <TextChannel>interaction.options.getChannel("channel", true);
                            const list = <ChannelListType>interaction.options.getString("list", true).trim();
                            if (list === "whitelist") {
                                await servers.updateOne(
                                    { 
                                        id: interaction.guildId 
                                    }, 
                                    {
                                        $setOnInsert: {
                                            update_roles: false,
                                            update_nickname: false,
                                            'channels.blacklist': [],
                                            roles: {}
                                        },
                                        $addToSet: {
                                            'channels.whitelist': channel.id
                                        }
                                    }, 
                                    { 
                                        upsert: true 
                                    }
                                );
                                await interaction.editReply(`${Formatters.channelMention(channel.id)} has been whitelisted for using commands. Having only whitelisted channels will blacklist all other channels. Use \`/settings channels remove\` to remove this command from the whitelist.`);
                            } else {
                                await servers.updateOne(
                                    { 
                                        id: interaction.guildId 
                                    }, 
                                    {
                                        $setOnInsert: {
                                            update_roles: false,
                                            update_nickname: false,
                                            'channels.whitelist': [],
                                            roles: {}
                                        },
                                        $addToSet: {
                                            'channels.blacklist': channel.id
                                        }
                                    }, 
                                    { 
                                        upsert: true 
                                    }
                                );
                                await interaction.editReply(`${Formatters.channelMention(channel.id)} has been blacklisted from using commands. All command responses will be ephemeral in blacklisted channels so that no one else can see them! To remove this command from the blacklist use \`/settings channels remove\`.`);
                            }
                            break;
                        }
                        case "remove": {
                            const channel = <TextChannel>interaction.options.getChannel("channel", true);
                            const list = <ChannelListType>interaction.options.getString("list", true).trim();
                            const res = await servers.updateOne({ id: interaction.guildId }, {
                                $pull: list === "blacklist" ? {
                                    'channels.blacklist': channel.id
                                } : {
                                    'channels.whitelist': channel.id
                                }
                            });
                            if (!res.modifiedCount) throw new DiscordClientError(`${Formatters.channelMention(channel.id)} does not seem to be in the command whitelist/blacklist...`);
                            await interaction.editReply(`${Formatters.channelMention(channel.id)} has been removed from command whitelist/blacklist!`);
                            break;
                        }
                        case "reset": {
                            await servers.updateOne({ id: interaction.guildId }, {
                                $set: {
                                    channels: {
                                        blacklist: [],
                                        whitelist: []
                                    }
                                }
                            });
                            await interaction.editReply("The channel whitelist and blacklist of this server have been reset!");
                            break;
                        }
                    }
                    break;
                }
                case "login": {
                    let update: Partial<typeof server> = {}, ok: boolean | number;
                    switch(subCommand) {
                        case "set": {
                            const allianceName = interaction.options.getString("alliance_name");
                            if (allianceName) {
                                const { status, alliance } = await rest.fetchAlliance(allianceName);
                                if (!status.success) throw new DiscordClientError(`**alliance_name:** ${status.error}`);
                                update.alliance_name = alliance.name;
                            }
                            const logChannel = <TextChannel>interaction.options.getChannel("log_channel");
                            if (logChannel) {
                                const permissions = logChannel.permissionsFor(interaction.guild.me);
                                if (!permissions.has("SEND_MESSAGES")) throw new DiscordClientError(`The bot does not have the permission to send messages in ${Formatters.channelMention(logChannel.id)}. Please fill in a log channel where the bot can send messages in.`);
                                update.log_channel = logChannel.id;
                            }
                            const options = interaction.options.data[0].options[0].options.filter(option => option.type === "BOOLEAN");
                            for (const option of options) update[option.name] = option.value;
                            const res = await servers.updateOne(
                                { 
                                    id: interaction.guildId 
                                }, 
                                {
                                    $set: update,
                                    $setOnInsert: {
                                        roles: {},
                                        channels: {
                                            whitelist: [],
                                            blacklist: []
                                        }
                                    }
                                }, 
                                { 
                                    upsert: true 
                                }
                            );
                            ok = res.acknowledged && (res.modifiedCount || res.upsertedCount);
                            break;
                        }
                        case "reset": {
                            const options = interaction.options.data[0].options[0].options;
                            for (const option of options) {
                                if (!option.value) continue;
                                update[option.name] = "";
                            }
                            type UnsetUpdate = { [name: string]: "" };
                            const res = await servers.updateOne({ id: interaction.guildId }, { $unset: <UnsetUpdate>update });
                            ok = res.acknowledged && (res.modifiedCount || res.upsertedCount);
                            break;
                        }
                    }
                    const inviteUrl = process.env.DISCORD_SERVER_INVITE;
                    if (inviteUrl === undefined) throw new Error("DISCORD_SERVER_INVITE must be provided!");
                    await interaction.editReply(ok ? "The login settings of this server have been updated." : `Failed to update the login settings of this server. Please try again or report this in ${inviteUrl}.`);
                    break;
                }
                case "view": {
                    if (!server) {
                        await interaction.editReply("This server does not have any settings saved yet...");
                        return;
                    }
                    const embed = new MessageEmbed({
                        color: "GREYPLE",
                        author: {
                            name: interaction.guild.name,
                            iconURL: interaction.guild.iconURL()
                        },
                        footer: {
                            text: `Server ID: ${interaction.guild}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        },
                        fields: [
                            {
                                name: Formatters.bold(Formatters.underscore("Options")),
                                value: `**Alliance:** ${server.alliance_name || "unknown"}\n**Update names:** ${server.update_nickname}\n**Update roles:** ${server.update_roles}`
                            },
                            {
                                name: Formatters.bold(Formatters.underscore("Roles")),
                                value: `**Default:** ${server.roles.default ? Formatters.roleMention(server.roles.default) : "none"}\n**Easy:** ${server.roles.easy ? Formatters.roleMention(server.roles.easy) : "none"}\n**Realism:** ${server.roles.realism ? Formatters.roleMention(server.roles.realism) : "none"}\n**Member:** ${server.roles.member ? Formatters.roleMention(server.roles.member) : "none"}`
                            }
                        ]
                    });
                    if (server.channels.whitelist.length) embed.addFields({
                        name: Formatters.bold(Formatters.underscore("Whitelisted Channels")),
                        value: server.channels.whitelist.map(Formatters.channelMention).join("\n"),
                        inline: true
                    });
                    if (server.channels.blacklist.length) embed.addFields({
                        name: Formatters.bold(Formatters.underscore("Blacklisted Channels")),
                        value: server.channels.blacklist.map(Formatters.channelMention).join("\n"),
                        inline: true
                    });
                    await interaction.editReply({ embeds: [embed] });
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