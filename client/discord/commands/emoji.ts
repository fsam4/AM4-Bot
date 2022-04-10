import { Permissions, MessageEmbed, Formatters, Constants, type ApplicationCommandOptionChoice } from 'discord.js';
import { MongoDB as Utils } from '../../utils';
import DiscordClientError from '../error';

import type { SlashCommand } from '@discord/types';
import type { Document } from 'mongodb';
import type { AM4 } from '@typings/database';

const { createTextFilter } = Utils;
const name = /\w+$/;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isGlobal: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS
    ]),
    data: {
        name: 'emoji',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage the AM4 emojis of this server',
        defaultPermission: false,
        options: [
            {
                name: 'upload',
                description: 'Upload an AM4 emoji to this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'plane',
                        description: 'Upload a plane as an emoji',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane to upload as an emoji',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'name',
                                description: 'The name to give to this emoji (max 20 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'achievement',
                        description: 'Upload an achievement icon as an emoji',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'achievement',
                                description: 'The name of the achievement to upload as an emoji',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'name',
                                description: 'The name to give to this emoji (max 20 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'am4',
                        description: 'Upload an AM4 icon as an emoji. Use "/emoji list" for all IDs.',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'id',
                                description: 'The ID of the icon (use "/emoji list" for all IDs)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: 'name',
                                description: 'The name to give to this emoji (max 20 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    }
                ]
            },
            {
                name: 'delete',
                description: 'Delete an existing AM4 emoji',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "id",
                        description: "The ID of the AM4 emoji",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: 'view',
                description: 'View all the AM4 emojis of this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            },
            {
                name: 'list',
                description: "Get a list of addable AM4 emojis",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            }
        ]
    },
    async execute(interaction, { database }) {
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
            const planes = database.am4.collection<AM4.Plane>('Planes');
            const achievements = database.am4.collection<AM4.Achievement>('Achievements');
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "list": {
                    const emojis = interaction.client.emojis.cache.filter(emoji => emoji.guild.id === '834178140208103454').toArray();
                    const amount = Math.ceil(emojis.length / 4);
                    const embed = new MessageEmbed({
                        title: "AM4 Emojis",
                        color: 16776960,
                        description: 'Below is a list of all available emojis. Use their ID to add them via `/emoji upload am4`. You can also upload planes as emojis via `/emoji upload plane` and achievement icons via `/emoji upload achievement`. To add emojis you need the manage emojis permission of this server!'
                    });
                    for (let i = 0; i < 4; i++) {
                        const field_emojis = emojis.splice(4, amount);
                        embed.addFields({
                            name: '\u200B', 
                            value: field_emojis.map(emoji => `${Formatters.inlineCode(emoji.id)}|${Formatters.formatEmoji(emoji.id)}`).join('\n'), 
                            inline: true
                        });
                    }
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case "delete": {
                    const emojiId = interaction.options.getString("id", true).trimEnd();
                    await interaction.guild.emojis.fetch(emojiId)
                    .then(async emoji => {
                        if (emoji.author.id !== interaction.client.user.id) throw new DiscordClientError("That is not a valid AM4 emoji ID...");
                        if (!emoji.deletable) throw new DiscordClientError("Unable to delete this emoji...");
                        await emoji.delete(`AM4 emoji deleted by ${interaction.user.username}#${interaction.user.discriminator}`);
                        await interaction.editReply("The emoji has been successfully deleted!");
                    })
                    .catch(async () => {
                        await interaction.editReply("Could not find an emoji with that ID from this server...");
                    });
                    break;
                }
                case "view": {
                    const emojis = await interaction.guild.emojis.fetch().then(emojis => emojis.filter(emoji => emoji.author.id === interaction.client.user.id));
                    if (!emojis.size) throw new DiscordClientError(`This server does not have any AM4 emojis added via ${interaction.client.user.username}...`);
                    const embed = new MessageEmbed({
                        color: "YELLOW",
                        description: emojis.map(emoji => `${Formatters.inlineCode(emoji.id)}|${Formatters.time(emoji.createdAt, "d")}|${Formatters.formatEmoji(emoji.id)}`).join('\n'),
                        author: {
                            name: interaction.guild.name,
                            iconURL: interaction.guild.iconURL()
                        },
                        footer: {
                            text: `Total stickers: ${emojis.size}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        }
                    });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case "upload": {
                    let buffer: Buffer | string;
                    const input = interaction.options.getString(subCommand === "am4" ? "id" : subCommand, true).trimEnd();
                    let emoji_name = interaction.options.getString("name")?.trimEnd();
                    if (emoji_name && emoji_name.length > 20) throw new DiscordClientError("An emoji name can at maximum be 20 characters!");
                    switch(subCommand) {
                        case 'plane': {
                            const plane = await planes.findOne(createTextFilter<AM4.Plane>(input));
                            if (!plane) throw new DiscordClientError(`No plane could be found with ${Formatters.bold(input)}...`);
                            emoji_name ||= plane.name.replace(/(\s|-)/, '_');
                            buffer = plane.image.buffer;
                            break;
                        }
                        case 'achievement': {
                            const achievement = await achievements.findOne(createTextFilter<AM4.Achievement>(input));
                            if (!achievement) throw new DiscordClientError(`No achievement could be found with ${Formatters.bold(input)}...`);
                            emoji_name ||= achievement.name.replace(/(\s|-)/, '_');
                            buffer = achievement.icon.buffer;
                            break;
                        }
                        default: {
                            const emojis = interaction.client.emojis.cache.filter(emoji => emoji.guild.id === '834178140208103454');
                            const icon = emojis.get(input);
                            if (!icon) throw new DiscordClientError('That is not a valid icon ID. Check `/emoji list` for all the valid icon IDs...');
                            emoji_name ||= icon.name;
                            buffer = icon.url;
                            break;
                        }
                    }
                    if (!name.test(emoji_name)) throw new DiscordClientError("That is not a valid name for an emoji! An emoji name can only contain letters, numbers and underscores.");
                    const options = { reason: `New ${subCommand} emoji added by ${interaction.user.username}#${interaction.user.discriminator}` };
                    await interaction.guild.emojis.create(buffer, emoji_name, options)
                    .then(async emoji => {
                        await interaction.editReply(`Added ${Formatters.formatEmoji(emoji.id)} to your server! The ID of this emoji is ${Formatters.bold(emoji.id)}.`);
                    })
                    .catch(async err => {
                        console.error("Failed to create an emoji", err);
                        await interaction.editReply("Failed to create that emoji for an unknown reason... Please make sure that this server still has available emoji slots!");
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
                            $options: focused.name === "plane" ? "ix" : "i" 
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
            let choices: ApplicationCommandOptionChoice[];
            if (focused.name === "plane") {
                const planes = database.am4.collection<AM4.Plane>("Planes");
                const cursor = planes.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
                choices = await cursor.toArray();
            } else {
                const achievements = database.am4.collection<AM4.Achievement>("Achievements");
                const cursor = achievements.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
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