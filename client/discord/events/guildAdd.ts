import { Formatters, type ApplicationCommandPermissionData } from 'discord.js';
import chalk from 'chalk';

import type { Event } from '@discord/types';

const locale = "en";

const event: Event = {
    name: 'guildCreate',
    once: false,
    async execute(guild, { log, client }) {
        console.log(chalk.green(`Joined ${guild.name}`));
        await log.send(`Welcome ${Formatters.bold(guild.name)} to AM4 Bot user servers! AM4 Bot is now used in ${Formatters.bold(client.guilds.cache.size.toLocaleString(locale))} servers!`);
        let commands = await client.application.commands.fetch().then(commands => {
            const admin_commands = client.chatCommands.filter(command => command.isAdministrator);
            return commands.filter(command => admin_commands.has(command.name));
        });
        const admin_roles = await guild.roles.fetch().then(roles => roles.filter(role => role.permissions.has("ADMINISTRATOR")));
        let permissions: ApplicationCommandPermissionData[] = admin_roles.map(role => ({
            id: role.id,
            type: "ROLE",
            permission: true
        }));
        if (permissions.length > 9) permissions = permissions.slice(0, 9);
        await guild.commands.permissions.set({
            fullPermissions: commands.map(command => ({
                id: command.id,
                permissions: [
                    ...permissions, 
                    {
                        id: guild.ownerId,
                        type: "USER" as const,
                        permission: true
                    }
                ]
            }))
        });
        if (guild.premiumTier !== "NONE") {
            const command = client.chatCommands.find(command => command.data.name === "sticker");
            await guild.commands.create(command.data);
        }
        client.user.setPresence({
            activities: [{
                type: "WATCHING",
                name: `Used in ${client.guilds.cache.size} servers`
            }]
        });
    }
}

export = event;