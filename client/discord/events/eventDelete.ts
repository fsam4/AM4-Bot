import type { Discord } from '@typings/database';
import type { Event } from '@discord/types';

const event: Event = {
    name: "guildScheduledEventDelete",
    once: false,
    async execute(scheduledEvent, { database }) {
        const giveaways = database.discord.collection<Discord.giveaway>("Giveaways");
        await giveaways.updateOne({ event: scheduledEvent.id }, {
            $unset: {
                event: ""
            }
        });
    }
}

export = event;