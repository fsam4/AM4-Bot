import { MessageEmbed, MessageActionRow, MessageSelectMenu, Formatters, MessageAttachment, Constants, type UserContextMenuInteraction } from 'discord.js';
import { Discord as Utils } from '../../utils';
import DiscordClientError from '../error';
import { emojis } from '../../../config.json';
import Plane from '../../../src/lib/plane';

import type { AM4, Settings, Discord } from '@typings/database';
import type { ContextMenu } from '@discord/types';

const { createAttachmentUrl, isCachedUserContextMenuInteraction } = Utils;

const command: ContextMenu<UserContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isAdministrator: false,
    isGlobal: true,
    data: {
        name: "Get Airline Fleet",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { database, rest, locale }) {
        if (!isCachedUserContextMenuInteraction(interaction)) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply();
        try {
            const users = database.discord.collection<Discord.User>("Users");
            const settings = database.settings.collection<Settings.User>('Users');
            const planeCollection = database.am4.collection<AM4.Plane>('Planes');
            const planeSettings = database.settings.collection<Settings.Plane>('Planes');
            const account = await users.findOne({ id: interaction.targetId });
            if (!account?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const { status, airline, fleet } = await rest.fetchAirline(account.airlineID);
            if (!status.success) throw new DiscordClientError(status.error);
            if (!fleet.size) throw new DiscordClientError("This airline does not have any planes in it's fleet...");
            const user = await settings.findOne({ id: interaction.user.id });
            const planes = await planeCollection.aggregate<AM4.Plane & { amount: number }>([
                {
                    $match: { 
                        name: { 
                            $in: fleet.planes.map(plane => plane.name) 
                        } 
                    }
                },
                {
                    $limit: 25
                },
                {
                    $addFields: {
                        amount: {
                            $let: {
                                vars: {
                                    fleet: fleet.planes
                                },
                                in: {
                                    $first: {
                                        $map: {
                                            input: {
                                                $filter: {
                                                    input: "$$fleet",
                                                    as: "plane",
                                                    cond: { $eq: ["$$plane.name", "$name"] }
                                                }
                                            },
                                            as: "plane",
                                            in: "$$plane.amount"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ]).toArray();
            if (!planes.length) throw new DiscordClientError("This airline does not have any planes in it's fleet...");
            const planeOptions = await planeSettings.find({ id: interaction.user.id }).toArray();
            for (const plane of planes) {
                const options = planeOptions.find(({ planeID }) => plane._id.equals(planeID));
                if (options) {
                    const { modifications, engine: engineName } = options;
                    if (engineName) {
                        const engine = plane.engines.find(engine => engine.name === engineName);
                        plane.speed = engine.speed;
                        plane.fuel = engine.fuel;
                    }
                    if (modifications.fuel) plane.fuel *= 0.9;
                    if (modifications.speed) plane.speed *= 1.1;
                    if (modifications.co2) plane.co2 *= 0.9;
                }
                if (user?.training.fuel) plane.fuel *= (100 - user.training.fuel) / 100;
                if (user?.training.co2) plane.co2 *= (100 - user.training.co2) / 100;
            }
            const select = new MessageSelectMenu({
                customId: "plane",
                placeholder: "Select an aircraft...",
                options: planes.map(plane => {
                    return {
                        label: plane.name,
                        value: plane._id.toHexString(),
                        description: `${plane.amount} planes`,
                        emoji: emojis[plane.type]
                    }
                })
            });
            let plane = planes[0];
            let image = new MessageAttachment(plane.image.buffer, "plane.jpg");
            const options = {
                activity: user?.options.activity ?? 18,
                fuelPrice: user?.options.fuel_price,
                co2Price: user?.options.co2_price,
                reputation: airline.reputation[plane.type],
                gameMode: airline.gameMode
            };
            let statistics = {
                profit: Plane.profit(plane, options).profit,
                sv: Plane.estimatedShareValueGrowth(plane, options)
            };
            const embed = new MessageEmbed({
                color: "BLURPLE",
                timestamp: airline.founded,
                description: `**Amount:** ${plane.amount} planes\n**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`,
                image: {
                    url: createAttachmentUrl(image)
                },
                author: {
                    name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '????': '????'}`,
                    iconURL: airline.displayLogoURL,
                    url: airline.displayLogoURL
                },
                footer: {
                    text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                },
                fields: [
                    { 
                        name: Formatters.bold(Formatters.underscore("General statistics")), 
                        value: `**Speed:** ${Math.round(airline.gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                        inline: true 
                    },
                    { 
                        name: '\u200B', 
                        value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(airline.gameMode === "Easy" ? plane.A_check.price / 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time}h\n**Pilots:** ${plane.staff.pilots} persons\n**Crew:** ${plane.staff.crew} persons\n**Engineers:** ${plane.staff.engineers} persons\n**Tech:** ${plane.staff.tech} persons`, 
                        inline: true 
                    },
                    { 
                        name: Formatters.bold(Formatters.underscore("Profitability")), 
                        value: `**Per hour:** $${Math.round(statistics.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${statistics.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(statistics.profit * 7).toLocaleString(locale)}\n**Share value:** $${statistics.sv.toFixed(2)}/day`, 
                        inline: false 
                    }
                ]
            });
            if (plane.price) {
                const profitability = Math.round(plane.price / statistics.profit);
                embed.fields.last().value += `\n**Profitability:** ${profitability > 0 ? `in ${profitability} days` : 'never' }`;
            }
            select.options[0].default = true;
            const row = new MessageActionRow({ components: [select] });
            const message = await interaction.editReply({
                embeds: [embed],
                files: [image],
                components: [row]
            });
            const collector = message.createMessageComponentCollector({ 
                filter: ({ user }) => user.id === interaction.user.id, 
                idle: 10 * 60 * 1000,
                componentType: "SELECT_MENU" 
            });
            collector.on("collect", async interaction => {
                const [plane_id] = interaction.values;
                plane = planes.find(plane => plane._id.equals(plane_id));
                image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                statistics = {
                    profit: Plane.profit(plane, options).profit,
                    sv: Plane.estimatedShareValueGrowth(plane, options)
                };
                embed.setDescription(`**Amount:** ${plane.amount} planes\n**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`);
                embed.setImage(createAttachmentUrl(image));
                embed.setFields([
                    { 
                        name: Formatters.bold(Formatters.underscore("General statistics")), 
                        value: `**Speed:** ${Math.round(airline.gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                        inline: true 
                    },
                    { 
                        name: '\u200B', 
                        value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(airline.gameMode === "Realism" ? plane.A_check.price * 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                        inline: true 
                    },
                    { 
                        name: Formatters.bold(Formatters.underscore("Profitability")), 
                        value: `**Per hour:** $${Math.round(statistics.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${statistics.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(statistics.profit * 7).toLocaleString(locale)}\n**Share value:** $${statistics.sv.toFixed(2)}/day`, 
                        inline: false 
                    }
                ]);
                if (plane.price) {
                    const profitability = Math.round(plane.price / statistics.profit);
                    embed.fields.last().value += `\n**Profitability:** ${profitability > 0 ? `in ${profitability.toLocaleString(locale)} days` : 'never' }`;
                }
                for (const option of select.options) option.default = plane._id.equals(option.value);
                await interaction.message.removeAttachments();
                row.components[0] = select;
                await interaction.update({
                    embeds: [embed],
                    files: [image],
                    components: [row]
                });
            });
            collector.on("end", async collected => {
                select.setDisabled(true);
                row.components[0] = select;
                const reply = collected.last() || interaction;
                await reply.editReply({ components: [row] }).catch(() => void 0);
            });
            if (fleet.planes.length > 25) await interaction.followUp({
                content: `Due to the amount of different plane models of this airline's fleet the bot will only display 25 out of ${fleet.size} planes.`,
                ephemeral: true
            });
        }
        catch(error) {
            if (error instanceof DiscordClientError) {
                await error.send(interaction);
            } else {
                console.error(`Error while executing ${interaction.commandName}`, error);
                await DiscordClientError.sendUnknownError(interaction);
            }
        }
    }
}

export = command;