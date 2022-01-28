import type { WebhookClient } from 'discord.js';
import type AM4RestClient from '@source/index';
import type { Worker } from 'cluster';

interface EventOptions {
    telegramWorker: Worker;
    discordWorker: Worker;
    log: WebhookClient;
}

interface EventNames {
    "dataUpdate": [AM4RestClient];
}

type EventHandler<K extends keyof EventNames> = {
    name: K;
    once: boolean;
    execute: (...args: [...EventNames[K], EventOptions]) => Promise<void>;
}

export type Event = { [P in keyof EventNames]: EventHandler<P> }[keyof EventNames];