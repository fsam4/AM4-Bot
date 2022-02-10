import type { WebhookClient } from 'discord.js';
import type AM4RestClient from '@source/index';
import type { Worker } from 'cluster';

interface EventOptions {
    telegramWorker: Worker;
    discordWorker: Worker;
    rest: AM4RestClient;
    log: WebhookClient;
}

type EventNames = "dataUpdate";

type EventHandler<K extends EventNames> = {
    name: K;
    once: boolean;
    execute: (options: EventOptions) => Promise<void>;
}

export type Event = { [P in EventNames]: EventHandler<P> }[EventNames];