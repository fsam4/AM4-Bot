import { Formatters } from 'discord.js';
import chalk from 'chalk';

import type { Settings, Discord } from '@typings/database';
import type { Event } from '@discord/types';

const locale = "en";

const event: Event = {
    name: 'guildDelete',
    once: false,
    async execute(guild, { database, client, log }) {
        console.log(chalk.red(`Removed from ${guild.name}`));
        await log.send(`AM4 Bot was removed from ${Formatters.bold(guild.name)}. AM4 Bot is now used in ${Formatters.bold(client.guilds.cache.size.toLocaleString(locale))} servers.`);
        const query = { server: guild.id };
        await database.settings.collection<Settings.Server>('Servers').deleteOne({ id: guild.id });
        await database.settings.collection<Settings.Webhook>("Webhooks").deleteMany(query);
        await database.discord.collection<Discord.Panel>("Panels").deleteMany(query);
        await database.discord.collection<Discord.Notification>("Notifications").deleteMany(query);
        await database.discord.collection<Discord.Giveaway>("Giveaways").deleteMany(query);
        await database.discord.collection<Discord.FAQ>("FAQ").deleteMany({ public: false, ...query });
        await guild.commands.permissions.set({ fullPermissions: [] }).catch(() => void 0);
        await guild.commands.fetch()
        .then(async commands => {
            if (commands.size) {
                await guild.commands.set([]);
            }
        })
        .catch(() => void 0);
        client.user.setPresence({
            activities: [{
                type: "WATCHING",
                name: `Used in ${client.guilds.cache.size} servers`
            }]
        });
    }
}

export = event;