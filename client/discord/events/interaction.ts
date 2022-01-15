import { Collection, Formatters, type TextChannel } from 'discord.js';
import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import addSeconds from 'date-fns/addSeconds';
import isFuture from 'date-fns/isFuture';

import type { Event, ComponentOptions, CommandOptions, ContextMenu, SlashCommand } from '../types';
import type { Discord, Settings } from '@typings/database';

const event: Event = {
    name: "interactionCreate",
    once: false,
    async execute(interaction, options) {
        if (interaction.user.bot || interaction.type === "PING") return;
        const { database, cooldowns } = options;
        const users = database.discord.collection<Discord.user>('Users');
        let user = await users.findOne({ id: interaction.user.id });
        if (!user) {
            const document: Discord.user = {
                id: interaction.user.id,
                notifications_made: 0,
                admin_level: 0,
                commands: [],
                warnings: []
            };
            const res = await users.insertOne(document);
            user = { ...document, _id: res.insertedId };
        }
        options.account = user;
        options.locale = interaction.locale || "en";
        options.guildLocale = interaction.guildLocale || "en";
        switch(interaction.type) {
            case "APPLICATION_COMMAND_AUTOCOMPLETE": {
                if (interaction.isAutocomplete()) {
                    if (user.mute && isFuture(user.mute)) return interaction.respond([]);
                    const command = interaction.client.chatCommands.get(interaction.commandName);
                    if (!command.autocomplete) return interaction.respond([]);
                    await command.autocomplete(interaction, <CommandOptions>options);
                }
                break;
            }
            case "APPLICATION_COMMAND": {
                if (interaction.isApplicationCommand()) {
                    if (user?.mute) {
                        if (isFuture(user.mute)) {
                            return interaction.reply({
                                content: `You have been suspended from using commands until ${Formatters.time(user.mute, "F")}!`,
                                ephemeral: true
                            });
                        } else {
                            await users.updateOne({ _id: user._id }, { $unset: { mute: "" } });
                        }
                    }
                    let command: ContextMenu | SlashCommand;
                    if (interaction.isCommand()) {
                        command = interaction.client.chatCommands.get(interaction.commandName);
                        if (interaction.inGuild()) {
                            const servers = database.settings.collection<Settings.server>("Servers");
                            const server = await servers.findOne({ id: interaction.guildId });
                            if (server && interaction.channel) {
                                let channelId = interaction.channelId;
                                if (interaction.channel.isThread()) channelId = interaction.channel.parentId;
                                options.ephemeral = (server.channels.whitelist.length && !server.channels.blacklist.length) ? !server.channels.whitelist.includes(channelId) : server.channels.blacklist.includes(channelId);
                            } else {
                                options.ephemeral = false;
                            }
                            if (interaction.guild) {
                                const permissions = interaction.guild.me.permissionsIn(<TextChannel>interaction.channel).missing(command.permissions);
                                if (permissions.length > 0) return await interaction.reply(`The bot has ${Formatters.bold(permissions.length.toString())} permissions missing that it requires for this command:\n${permissions.map(s => `► ${s.toLowerCase().replace(/_/g, " ")}`).join('\n')}`);
                            }
                        }
                    } else if (interaction.isContextMenu()) {
                        command = interaction.client.menuCommands.get(interaction.commandName);
                    }
                    if (!user?.admin_level) {
                        const globalCooldown = await cooldowns.get(interaction.user.id);
                        if (globalCooldown) {
                            const date = new Date(globalCooldown);
                            return interaction.reply({
                                content: `You currently have a global cooldown. The cooldown ends ${formatDistanceToNowStrict(date, { addSuffix: true })}...`,
                                ephemeral: true
                            });
                        } else {
                            if (!interaction.client.cooldowns.has(interaction.user.id)) interaction.client.cooldowns.set(interaction.user.id, new Collection());
                            const userCooldowns = interaction.client.cooldowns.get(interaction.user.id);
                            if (userCooldowns.has(interaction.commandId)) {
                                const cooldown = userCooldowns.get(interaction.commandId);
                                return interaction.reply({
                                    content: `You currently have a cooldown for this command. The cooldown ends ${formatDistanceToNowStrict(cooldown, { addSuffix: true })}...`,
                                    ephemeral: true
                                });
                            } else {
                                if (userCooldowns.size > 3) {
                                    const timeout = addSeconds(interaction.createdAt, 60);
                                    await cooldowns.set(interaction.user.id, timeout, 60 * 1000);
                                } else {
                                    const timeout = addSeconds(interaction.createdAt, command.cooldown);
                                    userCooldowns.set(interaction.commandId, timeout);
                                    setTimeout(() => userCooldowns.delete(interaction.commandId), command.cooldown * 1000)
                                }
                            }
                        }
                    }
                    // @ts-expect-error: the types will be always correct at runtime
                    await command.execute(interaction, options);
                    if (interaction.isCommand()) {
                        const hasCommand = user.commands.some(({ command: commandName }) => commandName === interaction.commandName);
                        const query = { _id: user._id };
                        if (hasCommand) {
                            await users.updateOne(query, {
                                $inc: {
                                    "commands.$[element].uses": 1
                                }
                            }, {
                                arrayFilters: [
                                    { "element.command": interaction.commandName }
                                ]
                            });
                        } else {
                            await users.updateOne(query, {
                                $push: {
                                    commands: {
                                        command: interaction.commandName,
                                        uses: 1
                                    }
                                }
                            });
                        }
                    }
                }
                break;
            }
            case "MESSAGE_COMPONENT": {
                if (interaction.isMessageComponent()) {
                    if (user?.mute) {
                        if (isFuture(user.mute)) {
                            return interaction.reply({
                                content: `You have been suspended from using commands until ${Formatters.time(user.mute, "F")}!`,
                                ephemeral: true
                            });
                        } else {
                            await users.updateOne({ _id: user._id }, { $unset: { mute: "" } });
                        }
                    }
                    options.parsedCustomId = interaction.customId.split(":");
                    const componentName = (<string[]>options.parsedCustomId).shift();
                    if (!interaction.client.components.has(componentName)) return;
                    const component = interaction.client.components.get(componentName);
                    if (!component.customId.test(interaction.customId)) return;
                    if (!user || user.admin_level < 1) {
                        const cooldown = await cooldowns.get(interaction.user.id);
                        if (cooldown) {
                            return interaction.reply({
                                content: `You currently have a global cooldown. The cooldown ends ${formatDistanceToNowStrict(new Date(cooldown), { addSuffix: true })}`,
                                ephemeral: true
                            });
                        } else if (component.cooldown) {
                            const timeout = addSeconds(interaction.createdAt, component.cooldown);
                            await cooldowns.set(interaction.user.id, timeout, component.cooldown * 1000);
                        }
                    }
                    await component.execute(interaction, <ComponentOptions>options);
                }
                break;
            }
        }
    }
}

export = event;