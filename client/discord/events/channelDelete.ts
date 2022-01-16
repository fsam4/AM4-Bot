import type { Discord, Settings } from '@typings/database';
import type { Event } from '../types';

const event: Event = {
    name: 'channelDelete',
    once: false,
    async execute(channel, { database }) {
        if (channel.type === "DM") return;
        if (channel.isText()) {
            const query = { channel: channel.id };
            await database.settings.collection<Settings.webhook>("Webhooks").deleteMany(query);
            await database.discord.collection<Discord.giveaway>("Giveaways").deleteMany(query);
            await database.discord.collection<Discord.panel>("Panels").deleteMany(query);
            await database.discord.collection<Discord.notification>("Notifications").deleteMany({ 
                webhooks: { 
                    $elemMatch: query 
                } 
            });
            if (!channel.isThread()) {
                await database.settings.collection<Settings.server>("Servers").updateOne(
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
}

export = event;