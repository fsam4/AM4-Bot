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
        if (interaction.type === "PING" || interaction.user.bot) return;
        const { database, cooldowns } = options;
        const users = database.discord.collection<Discord.user>('Users');
        let user = await users.findOne({ id: interaction.user.id });
        if (!user) {
            const userDocument: Discord.user = {
                id: interaction.user.id,
                notifications_made: 0,
                admin_level: 0,
                commands: [],
                warnings: []
            };
            const res = await users.insertOne(userDocument);
            user = { ...userDocument, _id: res.insertedId };
        }
        options.account = user;
        options.locale = interaction.locale || "en";
        options.guildLocale = interaction.guildLocale || "en";
        switch(interaction.type) {
            case "APPLICATION_COMMAND_AUTOCOMPLETE": {
                if (interaction.isAutocomplete()) {
                    if (user.mute && isFuture(user.mute)) {
                        await interaction.respond([])
                        .catch(() => undefined);
                        return;
                    }
                    const command = interaction.client.chatCommands.get(interaction.commandName);
                    if (!command.autocomplete) {
                        await interaction.respond([])
                        .catch(() => undefined);
                        return;
                    }
                    type AutoCompleteOptions = Omit<CommandOptions, "ephemeral">;
                    await command.autocomplete(interaction, <AutoCompleteOptions>options);
                }
                break;
            }
            case "APPLICATION_COMMAND": {
                if (interaction.isApplicationCommand()) {
                    if (user?.mute) {
                        if (isFuture(user.mute)) {
                            await interaction.reply({
                                content: `You have been suspended from using commands until ${Formatters.time(user.mute, "F")}!`,
                                ephemeral: true
                            });
                            return;
                        } else {
                            await users.updateOne({ _id: user._id }, { $unset: { mute: "" } });
                        }
                    }
                    let command: ContextMenu | SlashCommand;
                    if (interaction.isCommand()) {
                        options.ephemeral = false;
                        command = interaction.client.chatCommands.get(interaction.commandName);
                        if (interaction.inCachedGuild()) {
                            const servers = database.settings.collection<Settings.server>("Servers");
                            const server = await servers.findOne({ id: interaction.guildId });
                            if (server && interaction.channel) {
                                let channelId = interaction.channelId;
                                if (interaction.channel.isThread()) channelId = interaction.channel.parentId;
                                options.ephemeral = (server.channels.whitelist.length && !server.channels.blacklist.length) ? !server.channels.whitelist.includes(channelId) : server.channels.blacklist.includes(channelId);
                            }
                            const permissions = interaction.guild.me.permissionsIn(<TextChannel>interaction.channel).missing(command.permissions);
                            if (permissions.length > 0) {
                                await interaction.reply({
                                    content: `The bot has ${Formatters.bold(permissions.length.toString())} permissions missing that it requires for this command:\n${permissions.map(s => `► ${s.toLowerCase().replace(/_/g, " ")}`).join('\n')}`,
                                    ephemeral: options.ephemeral
                                });
                                return;
                            }
                        }
                    } else if (interaction.isContextMenu()) {
                        command = interaction.client.menuCommands.get(interaction.commandName);
                    }
                    if (!user?.admin_level) {
                        const globalCooldown = await cooldowns.get(interaction.user.id);
                        if (globalCooldown) {
                            const date = new Date(globalCooldown);
                            await interaction.reply({
                                content: `You currently have a global cooldown. The cooldown ends ${formatDistanceToNowStrict(date, { addSuffix: true })}...`,
                                ephemeral: true
                            });
                            return;
                        } else {
                            if (!interaction.client.cooldowns.has(interaction.user.id)) interaction.client.cooldowns.set(interaction.user.id, new Collection());
                            const userCooldowns = interaction.client.cooldowns.get(interaction.user.id);
                            if (userCooldowns.has(interaction.commandId)) {
                                const cooldown = userCooldowns.get(interaction.commandId);
                                await interaction.reply({
                                    content: `You currently have a cooldown for this command. The cooldown ends ${formatDistanceToNowStrict(cooldown, { addSuffix: true })}...`,
                                    ephemeral: true
                                });
                                return;
                            } else {
                                if (userCooldowns.size > 3) {
                                    const timeout = addSeconds(interaction.createdAt, 60);
                                    await cooldowns.set(interaction.user.id, timeout, 60 * 1000);
                                } else {
                                    const timeout = addSeconds(interaction.createdAt, command.cooldown);
                                    userCooldowns.set(interaction.commandId, timeout);
                                    setTimeout(userCooldowns.delete, command.cooldown * 1000, interaction.commandId);
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
                            await users.updateOne(query, 
                                {
                                    $inc: {
                                        "commands.$[element].uses": 1
                                    }
                                }, 
                                {
                                    arrayFilters: [
                                        { 
                                            "element.command": interaction.commandName 
                                        }
                                    ]
                                }
                            );
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
                            await interaction.reply({
                                content: `You have been suspended from using components until ${Formatters.time(user.mute, "F")}!`,
                                ephemeral: true
                            });
                            return;
                        } else {
                            await users.updateOne({ _id: user._id }, { $unset: { mute: "" } });
                        }
                    }
                    options.parsedCustomId = interaction.customId.split(":");
                    const componentName = (<string[]>options.parsedCustomId).shift();
                    if (!interaction.client.components.has(componentName)) return;
                    const component = interaction.client.components.get(componentName);
                    if (!component.customId.test(interaction.customId)) return;
                    if (!user?.admin_level) {
                        const cooldown = await cooldowns.get(interaction.user.id);
                        if (cooldown) {
                            await interaction.reply({
                                content: `You currently have a global cooldown. The cooldown ends ${formatDistanceToNowStrict(new Date(cooldown), { addSuffix: true })}`,
                                ephemeral: true
                            });
                            return;
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