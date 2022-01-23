import type { Telegraf, Scenes, NarrowedContext, Types, Context } from 'telegraf';
import type { CallbackQuery } from 'typegram';
import type AM4RestClient from '@source/index';
import type { Telegram } from '@typings/database';
import type { Worker } from 'cluster';
import type { Db } from 'mongodb';
import type Keyv from 'keyv';

interface BaseOptions {
    discordWorker: Worker;
    timeouts: Map<number, NodeJS.Timeout>;
    database: Readonly<Record<"am4" | "discord" | "settings" | "telegram" | "quiz", Db>>;
    cooldowns: Keyv<Date>;
    rest: AM4RestClient;
    bot: Telegraf;
    keyv: Keyv;
}

interface CommandOptions extends BaseOptions {
    account: Telegram.user;
}

type DataCallbackQuery = Extract<CallbackQuery, { data: string }>;

interface Action<ActionContext extends Context = Context> {
    value: string | RegExp;
    execute: (this: this, ctx: ActionContext & { callbackQuery: DataCallbackQuery }, options: CommandOptions) => Promise<void>;
}

interface Scene<SceneContext extends Context = Context> {
    scene: Scenes.BaseScene<SceneContext>;
    register: (this: this, options: BaseOptions) => Promise<void>;
}

export interface Command<CommandContext extends Context = Context, ActionContext extends Context = Context, SceneContext extends Context = Context> {
    name: string;
    cooldown?: number;
    description: string;
    help?: string;
    execute: (this: this, ctx: CommandContext, options: CommandOptions) => Promise<void>;
    actions: Action<ActionContext>[];
    scenes: Scene<SceneContext>[];
}

// These types are unused as I never got around to adding event listeners to the Telegram client.
// These event types work the same way as in the Discord client.

type UpdateContext<K extends keyof Types.MountMap> = NarrowedContext<Context, Types.MountMap[K]>;

type EventHandler<E extends Types.UpdateType> = {
    name: E;
    execute: (this: EventHandler<E>, ctx: UpdateContext<E>, options: BaseOptions) => Promise<void>;
}

export type Event = { [P in Types.UpdateType]: EventHandler<P> }[Types.UpdateType];

