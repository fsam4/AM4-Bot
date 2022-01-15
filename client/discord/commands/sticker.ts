import { Permissions, Formatters, MessageEmbed, Constants, type TextChannel, type ApplicationCommandOptionChoice } from 'discord.js';
import { MongoDB as Utils } from '../../utils';
import DiscordClientError from '../error';

import type { SlashCommand } from '../types';
import type { AM4_Data } from '@typings/database';
import type { Document } from 'mongodb';

const { createPlaneFilter, createAchievementFilter } = Utils;
const name = /\w+$/g;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isPublic: false,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS
    ]),
    data: {
        name: 'sticker',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage the AM4 stickers of this server',
        defaultPermission: false,
        options: [
            {
                name: 'upload',
                description: 'Upload an AM4 sticker to this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: 'plane',
                        description: 'Upload a plane as a sticker',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'plane',
                                description: 'The name of the plane to upload as a sticker',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'name',
                                description: 'The name to give to this sticker (max 20 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: 'description',
                                description: 'The description of the sticker (max 100 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'achievement',
                        description: 'Upload an achievement icon as a sticker',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'achievement',
                                description: 'The name of the achievement to upload as a sticker',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                autocomplete: true,
                                required: true
                            },
                            {
                                name: 'name',
                                description: 'The name to give to this sticker (max 20 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: 'description',
                                description: 'The description of the sticker (max 100 characters)',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    }
                ]
            },
            {
                name: 'delete',
                description: 'Delete an existing AM4 sticker',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "id",
                        description: "The ID of the AM4 sticker",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: 'view',
                description: 'View all the AM4 stickers of this server',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            }
        ]
    },
    async execute(interaction, { database }) {
        if (!interaction.guild) {
            await interaction.reply("This command requires the bot to be in this server...");
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const planes = database.am4.collection<AM4_Data.plane>('Planes');
        const achievements = database.am4.collection<AM4_Data.achievement>('Achievements');
        try {
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            if (interaction.guild.premiumTier === "NONE") {
                await interaction.editReply("Custom stickers can only be created in servers with a boost level of at least 1!");
                if (interaction.command) {
                    await interaction.command.delete();
                } else {
                    await interaction.guild.commands.delete(interaction.commandId);
                }
                return;
            }
            switch(group || subCommand) {
                case "delete": {
                    const stickerId = interaction.options.getString("id", true).trimEnd();
                    await interaction.guild.stickers.fetch(stickerId)
                    .then(async sticker => {
                        if (sticker.user.id !== interaction.client.user.id) throw new DiscordClientError("That is not an AM4 sticker...");
                        await sticker.delete(`AM4 sticker deleted by ${interaction.user.username}#${interaction.user.discriminator}`);
                        await interaction.editReply("The sticker has been successfully deleted!");
                    })
                    .catch(async () => {
                        await interaction.editReply("Could not find a sticker with that ID from this server...");
                    });
                    break;
                }
                case "view": {
                    const stickers = await interaction.guild.stickers.fetch().then(stickers => stickers.filter(emoji => emoji.user.id === interaction.client.user.id));
                    if (!stickers.size) throw new DiscordClientError("This server does not have any AM4 stickers added via AM4 Bot!");
                    const embed = new MessageEmbed({
                        color: "YELLOW",
                        description: stickers.map(sticker => `${Formatters.inlineCode(sticker.id)}|${Formatters.time(sticker.createdAt, "d")}|${sticker.name}`).join('\n'),
                        author: {
                            name: interaction.guild.name,
                            iconURL: interaction.guild.iconURL()
                        },
                        footer: {
                            text: `Total stickers: ${stickers.size}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        }
                    });
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case "upload": {
                    let buffer: Buffer | string, tags: string;
                    const input = interaction.options.getString(subCommand, true).trimEnd();
                    let sticker_name = interaction.options.getString("name")?.trimEnd();
                    let description = interaction.options.getString("description")?.trimEnd();
                    if (sticker_name && sticker_name.length > 20) throw new DiscordClientError("A sticker name can at maximum be 20 characters!");
                    if (description && description.length > 100) throw new DiscordClientError("A sticker description can at maximum be 100 characters!");
                    switch(subCommand) {
                        case 'plane': {
                            tags = ":airplane:";
                            const plane = await planes.findOne(createPlaneFilter(input));
                            if (!plane) throw new DiscordClientError(`No plane could be found with ${Formatters.bold(input)}...`);
                            description ||= `A sticker representing the plane model ${plane.name}. This sticker has been created via AM4 Bot.`;
                            sticker_name ||= plane.name.replace(/(\s|-)/, '_');
                            buffer = plane.image.buffer;
                            break;
                        }
                        case 'achievement': {
                            tags = ":trophy:";
                            const input = interaction.options.getString("name", true).trimEnd();
                            const achievement = await achievements.findOne(createAchievementFilter(input));
                            if (!achievement) throw new DiscordClientError(`No achievement could be found with ${Formatters.bold(input)}...`);
                            description ||= `A sticker representing the achievement ${achievement.name}. This sticker has been created via AM4 Bot.`;
                            sticker_name ||= achievement.name.replace(/(\s|-)/, '_');
                            buffer = achievement.icon.buffer;
                            break;
                        }
                    }
                    if (!name.test(sticker_name)) throw new DiscordClientError("That is not a valid name for an emoji! An emoji name can only contain letters, numbers and underscores.");
                    const options = {
                        reason: `New ${subCommand} sticker added by ${interaction.user.username}#${interaction.user.discriminator}`,
                        description: description
                    };
                    await interaction.guild.stickers.create(buffer, sticker_name, tags, options)
                    .then(async sticker => {
                        await interaction.editReply(`Added a new ${subCommand} sticker to your server! The ID of this sticker is ${Formatters.bold(sticker.id)}. You can now use the sticker in this server!`);
                        const channel = <TextChannel>interaction.channel;
                        const permissions = channel.permissionsFor(interaction.guild.me);
                        if (permissions.has("SEND_MESSAGES")) await channel.send({ stickers: [sticker] });
                    })
                    .catch(async err => {
                        console.error("Failed to create a sticker", err);
                        await interaction.editReply("Failed to create that sticker for an unknown reason... Please make sure that you still have available sticker places left!");
                    })
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
                const planes = database.am4.collection<AM4_Data.plane>("Planes");
                const cursor = planes.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
                choices = await cursor.toArray();
            } else {
                const achievements = database.am4.collection<AM4_Data.achievement>("Achievements");
                const cursor = achievements.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
                choices = await cursor.toArray();
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