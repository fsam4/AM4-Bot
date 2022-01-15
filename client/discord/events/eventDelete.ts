import type { Discord } from '@typings/database';
import type { Event } from '../types';

const event: Event = {
    name: "guildScheduledEventDelete",
    once: false,
    async execute(scheduledEvent, { database }) {
        await database.discord.collection<Discord.giveaway>("Giveaways").updateOne({ event: scheduledEvent.id }, {
            $unset: {
                event: ""
            }
        });
    }
}

export = event;