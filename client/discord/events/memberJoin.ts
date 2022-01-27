import { Formatters, MessageActionRow, MessageButton, type RoleResolvable, type TextChannel } from 'discord.js';

import type { Settings, Discord } from '@typings/database';
import type { Event } from '@discord/types';

const event: Event = {
    name: 'guildMemberAdd',
    once: false,
    async execute(member, { rest, database }) {
        if (member.user.bot) return;
        const permissions = member.guild.me.permissions;
        const servers = database.settings.collection<Settings.server>('Servers');
        const users = database.discord.collection<Discord.user>('Users');
        const server = await servers.findOne({ id: member.guild.id });
        if (server) {
            const user = await users.findOne({ id: member.id });
            if (user && user.airlineID) {
                const { airline, status } = await rest.fetchAirline(user.airlineID);
                if (status.success) {
                    if (server.update_nickname && permissions.has("MANAGE_NICKNAMES") && member.manageable) await member.setNickname(airline.name, `Logged in as ${airline.name}`);
                    if (server.update_roles && permissions.has("MANAGE_ROLES")) {
                        const roles = new Set<RoleResolvable>();
                        if (server.roles.default) roles.add(server.roles.default);
                        if (airline.alliance && server.roles.member && server.alliance_name) {
                            const isAllianceMember = airline.alliance.name === server.alliance_name;
                            if (isAllianceMember) roles.add(server.roles.member);
                        }
                        switch(airline.gameMode) {
                            case "Realism": {
                                if (!server.roles.realism) break;
                                roles.add(server.roles.realism);
                                break;
                            }
                            case "Easy": {
                                if (!server.roles.easy) break;
                                roles.add(server.roles.easy);
                                break;
                            }
                        }
                        if (roles.size) {
                            await member.roles.add([...roles], `Logged in as ${airline.name}`)
                            .catch(() => void 0);
                        }
                    }
                    if (server.log_channel) {
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
                                    content: `${Formatters.userMention(member.id)} has joined this server. They are logged in as ${Formatters.bold(airline.name)}.`,
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
}

export = event;