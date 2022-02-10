import { Formatters, MessageActionRow, MessageButton, type TextChannel } from 'discord.js';

import type { Settings, Discord } from '@typings/database';
import type { Event } from '@discord/types';

const event: Event = {
    name: "guildMemberRemove",
    once: false,
    async execute(member, { database, rest }) {
        if (member.user.bot) return;
        const servers = database.settings.collection<Settings.Server>('Servers');
        const users = database.discord.collection<Discord.User>('Users');
        const server = await servers.findOne({ id: member.guild.id });
        if (server && server.log_channel) {
            const user = await users.findOne({ id: member.id });
            if (user && user.airlineID) {
                const { airline, status } = await rest.fetchAirline(user.airlineID);
                if (status.success) {
                    await member.guild.channels.fetch(server.log_channel)
                    .then(async (logChannel: TextChannel) => {
                        const permissions = logChannel.permissionsFor(member.guild.me);
                        if (permissions.has("SEND_MESSAGES")) {
                            const row = new MessageActionRow({
                                components: [
                                    new MessageButton({
                                        customId: `airline:${user.airlineID}`,
                                        label: "Search airline",
                                        style: "SECONDARY",
                                        emoji: "🔎"
                                    })
                                ]
                            });
                            await logChannel.send({
                                content: `${Formatters.bold(`${member.user.username}#${member.user.discriminator}`)} has left this server. They were logged in as ${Formatters.bold(airline.name)}.`,
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
    }
}

export = event;