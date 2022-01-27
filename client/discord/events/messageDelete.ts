import type { Discord } from '../../../typings/database';
import type { Event } from '@discord/types';

const event: Event = {
    name: 'messageDelete',
    once: false,
    async execute(message, { database, client }) {
        if (!message.partial && message.channel.type === "DM") return;
        const query = { message: message.id };
        const panel = await database.discord.collection<Discord.panel>('Panels').deleteOne(query);
        if (panel.deletedCount || (!message.partial && message.author.id !== client.user.id)) return;
        const giveaway = await database.discord.collection<Discord.giveaway>('Giveaways').deleteOne(query);
        if (giveaway.deletedCount) return;
        const notifications = database.discord.collection<Discord.notification>('Notifications');
        await notifications.updateOne({ webhooks: { $elemMatch: query } }, {
            $pull: {
                webhooks: query
            }
        });
    }
}

export = event;