import type { WebhookClient } from 'discord.js';
import type AM4RestClient from '@source/index';
import type { Worker } from 'cluster';

type Awaitable<T> = T | PromiseLike<T>;

interface EventOptions {
    telegramWorker: Worker;
    discordWorker: Worker;
    rest: AM4RestClient;
    log: WebhookClient;
}

type EventNames = "dataUpdate";
type Listener = (options: EventOptions) => Awaitable<void>;

export type EventListeners = { [P in EventNames]: Listener };

type EventHandler<K extends EventNames> = {
    name: K;
    once: boolean;
    execute: Listener;
}

export type Event = { [P in EventNames]: EventHandler<P> }[EventNames];