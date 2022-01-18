import { Formatters } from 'discord.js';
import chalk from 'chalk';

import type { Settings, Discord } from '@typings/database';
import type { Event } from '../types';

const locale = "en";

const event: Event = {
    name: 'guildDelete',
    once: false,
    async execute(guild, { database, client, log }) {
        console.log(chalk.red(`Removed from ${guild.name}`));
        await log.send(`AM4 Bot was removed from ${Formatters.bold(guild.name)}. AM4 Bot is now used in ${Formatters.bold(client.guilds.cache.size.toLocaleString(locale))} servers.`);
        const query = { server: guild.id };
        await database.settings.collection<Settings.server>('Servers').deleteOne({ id: guild.id });
        await database.settings.collection<Settings.webhook>("Webhooks").deleteMany(query);
        await database.discord.collection<Discord.panel>("Panels").deleteMany(query);
        await database.discord.collection<Discord.notification>("Notifications").deleteMany(query);
        await database.discord.collection<Discord.giveaway>("Giveaways").deleteMany(query);
        await guild.commands.permissions.set({ fullPermissions: [] }).catch(() => undefined);
        await guild.commands.fetch()
        .then(async commands => {
            if (commands.size) {
                await guild.commands.set([]);
            }
        })
        .catch(() => undefined);
        client.user.setPresence({
            activities: [{
                type: "WATCHING",
                name: `Used in ${client.guilds.cache.size} servers`
            }]
        });
    }
}

export = event;