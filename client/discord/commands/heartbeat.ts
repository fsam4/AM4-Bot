import { Permissions, MessageButton, MessageActionRow, Formatters, Constants, type TextChannel } from 'discord.js';

import type { SlashCommand } from '../types';
import type { Settings } from '@typings/database';

const requiredPermissions = [
    Permissions.FLAGS.MANAGE_ROLES,
    Permissions.FLAGS.KICK_MEMBERS,
    Permissions.FLAGS.BAN_MEMBERS,
    Permissions.FLAGS.MANAGE_NICKNAMES,
    Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS,
    Permissions.FLAGS.MANAGE_WEBHOOKS,
    Permissions.FLAGS.VIEW_CHANNEL,
    Permissions.FLAGS.SEND_MESSAGES,
    Permissions.FLAGS.EMBED_LINKS,
    Permissions.FLAGS.ATTACH_FILES,
    Permissions.FLAGS.MANAGE_MESSAGES,
    Permissions.FLAGS.READ_MESSAGE_HISTORY,
    Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
    Permissions.FLAGS.USE_APPLICATION_COMMANDS,
    Permissions.FLAGS.ADD_REACTIONS,
    Permissions.FLAGS.USE_PUBLIC_THREADS,
    Permissions.FLAGS.MANAGE_THREADS
];

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 0,
    isPublic: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS
    ]),
    data: {
        name: 'heartbeat',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Test the bot for any issues in this server",
        defaultPermission: true
    },
    async execute(interaction, { database, rest, guildLocale }) {
        if (interaction.channel.type === "DM") {
            await interaction.reply("This command can only be used in servers...");
            return;
        };
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            const invite = interaction.client.generateInvite({
                disableGuildSelect: true,
                permissions: requiredPermissions,
                guild: interaction.guildId,
                scopes: ["bot"]
            });
            const button = new MessageButton({
                label: "Invite AM4 Bot",
                style: "LINK",
                url: invite
            });
            const row = new MessageActionRow({ components: [button] });
            await interaction.editReply({
                content: "To get the full features of AM4 Bot, please invite the bot itself to the server! The features of AM4 Bot are limited without the bot user.",
                components: [row]
            });
            return;
        }
        const canUseExternalEmojis = interaction.guild.roles.everyone.permissions.has(Permissions.FLAGS.USE_EXTERNAL_EMOJIS);
        if (!canUseExternalEmojis) {
            await interaction.editReply({
                content: `Allow the ${Formatters.roleMention("everyone")} role to use external emojis in this server for the emojis to display properly in the AM4 Bot responses.`,
                allowedMentions: {
                    roles: [],
                    users: []
                }
            });
            return;
        }
        const missingPermissions = interaction.guild.me.permissions.missing(requiredPermissions);
        if (missingPermissions.length) {
            const perms = missingPermissions.map(permission => permission.replace(/_/g, " ").replace(/(^\w{1})|(\s{1}\w{1})/g, match => match.toUpperCase()));
            await interaction.editReply(`AM4 Bot has ${Formatters.bold(missingPermissions.length.toLocaleString(guildLocale))} missing permissions in this server that it requires. Having some permissions disabled can limit the features of AM4 Bot and cause issues. The missing permissions are:\n${Formatters.blockQuote(perms.join("\n"))}`);
            return;
        }
        const servers = database.settings.collection<Settings.server>("Servers");
        const server = await servers.findOne({ id: interaction.guildId });
        if (server) {
            if (server.alliance_name) {
                const { status } = await rest.fetchAlliance(server.alliance_name);
                if (!status.success && status.requestsRemaining) {
                    await interaction.editReply(`The saved alliance name of this server (${Formatters.italic(server.alliance_name)}) is outdated. It is suggested to update it with \`/settings login set\` or reset it with \`/settings login reset\`. Having an outdated alliance name can cause issues with logins. For help with settings use \`/help\` and go to the settings section.`);
                    return;
                }
            } else if (server.log_channel) {
                const channel: TextChannel = await interaction.guild.channels.fetch(server.log_channel, { force: true }).catch(err => void err);
                if (!channel) {
                    await interaction.editReply(`Your log channel does not seem to exist anymore. Please update it or reset it via \`/settings login\`.`);
                    return;
                }
                const permissions = channel.permissionsFor(interaction.guild.me);
                if (!permissions.has("SEND_MESSAGES")) {
                    await interaction.editReply(`Your log channel is set as ${Formatters.channelMention(server.log_channel)}. Please make sure the bot has the ability to send messages in to this channel!`);
                    return;
                }
            }
        }
        const button = new MessageButton({
            label: "Support Server",
            url: "https://discord.gg/ZNYXSVNKb9",
            style: "LINK"
        });
        const row = new MessageActionRow({ components: [button] });
        await interaction.editReply({
            content: `No issues were detected that could affect the usability of AM4 Bot. If you find any undetected issues please report them in our support server! The current ping of AM4 Bot is ${Formatters.bold(`${interaction.client.ws.ping}ms`)}.`,
            components: [row]
        });
    }
}

export = command;