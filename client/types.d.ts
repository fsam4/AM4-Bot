import type AM4Client from '@source/index';
import type { Worker } from 'cluster';

interface EventOptions {
    telegramWorker: Worker;
    discordWorker: Worker;
}

interface EventNames {
    "dataUpdate": [AM4Client];
}

type EventType = "worker" | "master";

type EventHandler<K extends keyof EventNames> = {
    name: K;
    type: EventType;
    once: boolean;
    execute: (...args: [...EventNames[K], EventOptions]) => Promise<void>;
}

export type Event = { [P in keyof EventNames]: EventHandler<P> }[keyof EventNames];