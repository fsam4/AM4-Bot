import type { Discord } from '../../../typings/database';
import type { Event } from '../types';

const event: Event = {
    name: 'messageDelete',
    once: false,
    async execute(message, { database, client }) {
        if (!message.partial && message.channel.type === "DM") return;
        const query = { message: message.id };
        await database.discord.collection<Discord.panel>('Panels').deleteOne(query);
        if (!message.partial && message.author.id !== client.user.id) return;
        await database.discord.collection<Discord.giveaway>('Giveaways').deleteOne(query);
        const notifications = database.discord.collection<Discord.notification>('Notifications');
        await notifications.updateOne({ webhooks: { $elemMatch: query } }, {
            $pull: {
                webhooks: query
            }
        });
    }
}

export = event;