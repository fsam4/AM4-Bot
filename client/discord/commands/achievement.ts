import { MessageEmbed, Permissions, MessageAttachment, Formatters, MessageButton, MessageActionRow, Constants, type Message, type ApplicationCommandOptionChoice } from 'discord.js';
import DiscordClientError from '../error';
import * as Utils from '../../utils';
import { emojis } from '../../../config.json';
import Route from '../../../src/classes/route';

import type { AM4_Data, Settings } from '@typings/database';
import type { SlashCommand } from '@discord/types';
import type { Document } from 'mongodb';

const { createAchievementFilter } = Utils.MongoDB;
const { formatCode } = Utils.Discord;
const spoiler = /\|\|/g;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.ATTACH_FILES
    ]),
    data: {
        name: 'achievement',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Search for an achievement and it's solution",
        defaultPermission: true,
        options: [
            {
                name: 'name',
                description: 'The name of the achievement',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                autocomplete: true,
                required: true
            }
        ]
    },
    async execute(interaction, { database, locale }) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const users = database.settings.collection<Settings.user>('Users');
            const achievements = database.am4.collection<AM4_Data.achievement>('Achievements');
            const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
            const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
            const user = new Utils.User(interaction.user.id, await users.findOne({ id: interaction.user.id }));
            const input = interaction.options.getString("name", true).trim();
            const achievement = await achievements.findOne(createAchievementFilter(input));
            if (!achievement) throw new DiscordClientError(`No achievement ${Formatters.bold(input)} was found...`);
            const icon = new MessageAttachment(achievement.icon.buffer, "achievement.jpg");
            const files = [icon];
            const embed = new MessageEmbed({
                color: "GOLD",
                title: achievement.name,
                timestamp: achievement._id.getTimestamp(),
                thumbnail: {
                    url: `attachment://${icon.name}`
                }
            });
            if (achievement.route.length) {
                const airports = await airportCollection.aggregate<AM4_Data.airport>([
                    {
                        $match: { 
                            _id: { $in: achievement.route } 
                        }
                    },
                    {
                        $addFields: {
                            index: {
                                $indexOfArray: [achievement.route, "$_id"]
                            }
                        }
                    },
                    {
                        $sort: {
                            index: 1
                        }
                    },
                    {
                        $project: {
                            index: false
                        }
                    }
                ]).toArray();
                const locations = airports.map(airport => airport.location.coordinates);
                type Locations = Parameters<typeof Route.distance>;
                const { distance, distances } = Route.distance(...locations as Locations);
                embed.addFields([
                    {
                        name: Formatters.bold(Formatters.underscore("Achievement info")),
                        value: `**Reward:** ${achievement.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}\n**Hint:** ${achievement.hint}`
                    },
                    {
                        name: Formatters.bold(Formatters.underscore("Route")),
                        value: `**Departure:** ${Formatters.spoiler(`${airports[0].city.capitalize()} (${formatCode(airports[0], user.options.code)})`)}${airports.length > 2 ? `\n**Stopover:** ${Formatters.spoiler(`${airports[1].city.capitalize()} (${formatCode(airports[1], user.options.code)})`)}\n` : `\n`}**Arrival:** ${Formatters.spoiler(`${airports.last().city.capitalize()} (${formatCode(airports.last(), user.options.code)})`)}`
                    }
                ]);
                if (distance) embed.fields[1].value += `\n**Distance:** ${Formatters.spoiler(distance.toLocaleString(locale))} km`;
                const range = {
                    $cond: {
                        if: { $gt: [achievement.route.length, 2] },
                        then: "$range",
                        else: { $multiply: ["$range", 2] }
                    }
                };
                let planes = await planeCollection.find({ 
                    $expr: { $gte: [range, Math.max(...distances)] },
                    price: { $exists: true }
                })
                .sort({ price: 1 })
                .toArray();
                const realismPlane = planes.find(plane => plane.runway < Math.min(...airports.map(airport => airport.runway)));
                embed.setDescription(`**Cheapest plane for easy:** ${Formatters.spoiler(planes[0].name)}\n**Cheapest plane for realism:** ${Formatters.spoiler(realismPlane.name)}`);
            } else {
                embed.setDescription(Formatters.spoiler(achievement.description));
                embed.addFields({
                    name: Formatters.bold(Formatters.underscore("Achievement info")), 
                    value: `**Reward:** ${achievement.bonus_points.toLocaleString(locale)} Bonus points\n**Hint:** ${achievement.hint}`, 
                    inline: false
                });
            }
            if (achievement.image) {
                const map = new MessageAttachment(achievement.image, "map.jpg");
                map.setSpoiler(true);
                embed.setImage(`attachment://${map.name}`);
                files.push(map);
            };
            const row = new MessageActionRow({
                components: [
                    new MessageButton({
                        label: "Remove spoilers",
                        customId: "removeSpoilers",
                        style: "PRIMARY",
                        emoji: "⚠️"
                    })
                ]
            });
            const message = await interaction.editReply({ embeds: [embed], components: [row], files }) as Message;
            await message.awaitMessageComponent({ time: 5 * 60 * 1000, componentType: "BUTTON" }) 
            .then(async button => {
                if (button.customId === "removeSpoilers") {
                    row.components[0].setDisabled(true);
                    embed.description = embed.description.replace(spoiler, "");
                    for (const field of embed.fields) field.value = field.value.replace(spoiler, "");
                    await button.update({ 
                        embeds: [embed], 
                        components: [row]
                    });
                }
            })
            .catch(async () => {
                row.components[0].setDisabled(true);
                await interaction.editReply({ components: [row] }).catch(() => void 0);
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
        const achievements = database.am4.collection<AM4_Data.achievement>('Achievements');
        const focused = <string>interaction.options.getFocused();
        try {
            const value = focused?.slice(0, 15).match(/(\w|-|\s){1,}/g)?.join("");
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
                            $options: "i" 
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
            const cursor = achievements.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
            const choices = await cursor.toArray();
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