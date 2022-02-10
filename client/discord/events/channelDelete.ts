import type { Discord, Settings } from '@typings/database';
import type { Event } from '@discord/types';

const event: Event = {
    name: 'channelDelete',
    once: false,
    async execute(channel, { database }) {
        if (channel.type === "DM") return;
        if (channel.isText()) {
            const query = { channel: channel.id };
            await database.settings.collection<Settings.Webhook>("Webhooks").deleteMany(query);
            await database.discord.collection<Discord.Giveaway>("Giveaways").deleteMany(query);
            await database.discord.collection<Discord.Panel>("Panels").deleteMany(query);
            await database.discord.collection<Discord.Notification>("Notifications").deleteMany({ 
                webhooks: { 
                    $elemMatch: query 
                } 
            });
            await database.settings.collection<Settings.Server>("Servers").updateOne(
                { 
                    id: channel.guildId, 
                    $or: [
                        { 'channels.whitelist': channel.id },
                        { 'channels.blacklist': channel.id }
                    ] 
                }, 
                {
                    $pull: {
                        'channels.whitelist': channel.id,
                        'channels.blacklist': channel.id
                    }
                }
            );
        }
    }
}

export = event;