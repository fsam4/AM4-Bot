import { Permissions, Formatters, Constants, type GuildMember, type BanOptions } from 'discord.js';
import DiscordClientError from '../error';
import isFuture from 'date-fns/isFuture';

import type { SlashCommand } from '@discord/types';

const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
};

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isGlobal: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.MODERATE_MEMBERS,
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.BAN_MEMBERS,
        Permissions.FLAGS.KICK_MEMBERS,
        Permissions.FLAGS.MANAGE_NICKNAMES
    ]),
    data: {
        name: 'member',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage guild members',
        defaultPermission: false,
        options: [
            {
                name: 'ban',
                description: 'Ban a member',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'user',
                        description: 'The user to ban',
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: true
                    },
                    {
                        name: 'reason',
                        description: 'The reason for this ban',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'days',
                        description: 'The time in days that the ban lasts for. If not filled will be until unbanned.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        required: false
                    }
                ]
            },
            {
                name: 'kick',
                description: 'Kick a member',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'user',
                        description: 'The user to kick',
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: true
                    },
                    {
                        name: 'reason',
                        description: 'The reason for this ban',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: 'nickname',
                description: "Change the nickname of a member",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'user',
                        description: "The user who's nickname to change",
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: true
                    },
                    {
                        name: 'name',
                        description: "The nickname",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'reason',
                        description: 'The reason for this ban',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: "timeout",
                description: "Manage member timeouts",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'set',
                        description: "Set a timeout for a member",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'user',
                                description: "The user who you want to timeout",
                                type: Constants.ApplicationCommandOptionTypes.USER,
                                required: true
                            },
                            {
                                name: 'format',
                                description: "The time format to use in the next option",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true,
                                choices: [
                                    {
                                        name: "Seconds",
                                        value: "s"
                                    },
                                    {
                                        name: "Minutes",
                                        value: "m"
                                    },
                                    {
                                        name: "Hours",
                                        value: "h"
                                    },
                                    {
                                        name: "Days",
                                        value: "d"
                                    }
                                ]
                            },
                            {
                                name: 'time',
                                description: "The time to timeout to this user for. Time format specified in previous option.",
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                required: true
                            },
                            {
                                name: 'reason',
                                description: 'The reason for this ban',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'clear',
                        description: "Clear a member's timeout",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'user',
                                description: "The user who's timeout you want to clear",
                                type: Constants.ApplicationCommandOptionTypes.USER,
                                required: true
                            },
                            {
                                name: 'reason',
                                description: 'The reason for this ban',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'get',
                        description: "Get the current timeout of a member",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'user',
                                description: "The user who's timeout you want to clear",
                                type: Constants.ApplicationCommandOptionTypes.USER,
                                required: true
                            }
                        ]
                    }
                ]
            }
        ]
    },
    async execute(interaction) {
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
            const subCommand = interaction.options.getSubcommand(false);
            const subCommandGroup = interaction.options.getSubcommandGroup(false);
            const member = <GuildMember>interaction.options.getMember("user", true);
            let reason = interaction.options.getString("reason")?.trimEnd() || `By ${interaction.user.username}`;
            switch(subCommandGroup || subCommand) {
                case "ban": {
                    let options: BanOptions = {};
                    if (!member.bannable) throw new DiscordClientError('I cannot ban that member...');
                    const days = interaction.options.getInteger("days");
                    if (days) options.days = days;
                    options.reason = reason;
                    await member.send(`You have been banned by ${Formatters.bold(`${interaction.user.username}#${interaction.user.discriminator}`)} from ${Formatters.bold(interaction.guild.name)}${options.days ? ` for ${options.days} days.` : '.'} ${options.reason ? `The reason for this ban was "${options.reason}"` : 'No reason for this ban was specified.'}`);
                    await member.ban(options);
                    await interaction.editReply(`${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has been banned!`);
                    break;
                }
                case "kick": {
                    if (!member.kickable) throw new DiscordClientError('I cannot kick that member...');
                    await member.send(`You have been kicked by ${Formatters.bold(`${interaction.user.username}#${interaction.user.discriminator}`)} from ${Formatters.bold(interaction.guild.name)}. ${reason ? `The reason for this kick was "${reason}"` : 'No reason for this kick was specified.'}`);
                    await member.kick(reason || `By ${interaction.user.username}`);
                    await interaction.editReply(`${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has been kicked!`);
                    break;
                }
                case "nickname": {
                    if (!member.manageable) throw new DiscordClientError('I cannot manage that member...');
                    const nickname = interaction.options.getString("name").trimEnd();
                    await member.setNickname(nickname, reason || `By ${interaction.user.username}`);
                    await interaction.editReply(`The username of ${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has been updated from ${Formatters.bold(member.displayName)} to ${Formatters.bold(nickname)}.`);
                    break;
                }
                case "timeout": {
                    switch(subCommand) {
                        case "set": {
                            if (!member.moderatable) throw new DiscordClientError('I cannot moderate that member...');
                            const format = interaction.options.getString("format", true) as keyof typeof multipliers;
                            const time = interaction.options.getInteger("time", true);
                            const ms = time * multipliers[format];
                            await member.timeout(ms, reason);
                            await interaction.editReply(`${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has been timed out until ${Formatters.time(ms / 1000, "F")}!`);
                            break;
                        }
                        case "clear": {
                            if (!member.moderatable) throw new DiscordClientError('I cannot moderate that member...');
                            if (member.isCommunicationDisabled() as boolean) {
                                await member.timeout(null, reason);
                                await interaction.editReply(`The timeout of ${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has been cleared!`);
                            } else {
                                await interaction.editReply(`${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} is currently not timed out...`);
                            }
                            break;
                        }
                        case "get": {
                            const timeout = member.communicationDisabledUntil;
                            const response = timeout && isFuture(timeout) ? `${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} is timed out until ${Formatters.time(timeout, "F")}.` : `${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} is currently not timed out...`;
                            await interaction.editReply(response);
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
    }
}

export = command;