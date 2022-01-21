import type { Settings } from '@typings/database';
import type { Event } from '../types';

const event: Event = {
    name: "webhookUpdate",
    once: false,
    async execute(channel, { database, client, webhook, log }) {
        const permissions = channel.permissionsFor(channel.guild.me);
        if (permissions.has("MANAGE_WEBHOOKS")) {
            const systemWebhooks = [webhook.id, log.id];
            const webhookCollection = database.settings.collection<Settings.webhook>('Webhooks');
            const webhooks = await channel.fetchWebhooks()
            .then(webhooks => webhooks.filter(webhook => webhook.owner.id === client.user.id && !systemWebhooks.includes(webhook.id)));
            if (webhooks.size) {
                const webhookClients = webhooks.map(webhook => webhook.id);
                await webhookCollection.bulkWrite([
                    {
                        updateMany: {
                            filter: { id: { $in: webhookClients } },
                            update: {
                                $set: {
                                    channel: channel.id
                                }
                            }
                        }
                    },
                    {
                        deleteMany: {
                            filter: { 
                                channel: channel.id,
                                id: { $not: { $in: webhookClients } } 
                            }
                        }
                    }
                ]);
            }
        }
    }
}

export = event;