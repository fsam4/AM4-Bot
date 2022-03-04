import type AM4RestClient from '@source/index';
import type * as Database from '@typings/database';
import type { Db, ObjectId } from 'mongodb';
import type { Worker } from 'cluster';
import type Discord from 'discord.js';
import type Keyv from 'keyv';

type DatabaseNames = "am4" | "discord" | "settings" | "telegram" | "quiz";

interface BaseOptions {
    database: Readonly<Record<DatabaseNames, Db>>;
    timeouts: Map<ObjectId, NodeJS.Timeout>;
    webhook: Discord.WebhookClient;
    log: Discord.WebhookClient;
    telegramWorker: Worker;
    cooldowns: Keyv<Date>;
    client: Discord.Client;
    rest: AM4RestClient;
}

interface CommandOptions extends BaseOptions {
    account: Database.Discord.User;
    ephemeral: boolean;
    guildLocale: string;
    locale: string;
}

interface ContextMenuOptions extends BaseOptions {
    account: Database.Discord.User;
    guildLocale: string;
    locale: string;
}

interface ComponentOptions extends BaseOptions {
    account: Database.Discord.User;
    parsedCustomId: string[];
    guildLocale: string;
    locale: string;
}

interface EventOptions extends BaseOptions {
    [key: string]: any;
}

interface Command {
    get name(): string;
    set name(value: string);
    readonly cooldown: number;
    readonly isGlobal: boolean;
    readonly isAdministrator: boolean;
}

export interface SlashCommand extends Command {
    readonly permissions: Discord.Permissions;
    data: Discord.ApplicationCommandData & { type: Extract<Discord.ApplicationCommandType, "CHAT_INPUT"> | typeof Discord.Constants.ApplicationCommandTypes.CHAT_INPUT };
    execute: (this: this, interaction: Discord.CommandInteraction, options: CommandOptions) => Discord.Awaitable<void>;
    autocomplete?: (this: this, interaction: Discord.AutocompleteInteraction, options: Omit<CommandOptions, "ephemeral">) => Discord.Awaitable<void>;
}

export interface ContextMenu<I extends Discord.ContextMenuInteraction = Discord.ContextMenuInteraction> extends Command {
    data: Discord.ApplicationCommandData & { type: Exclude<Discord.ApplicationCommandType, "CHAT_INPUT"> | typeof Discord.Constants.ApplicationCommandTypes.MESSAGE | typeof Discord.Constants.ApplicationCommandTypes.USER };
    execute: (this: this, interaction: I, options: ContextMenuOptions) => Discord.Awaitable<void>;
}

export interface Component<I extends Discord.MessageComponentInteraction = Discord.MessageComponentInteraction> {
    name: string;
    readonly cooldown: number;
    readonly customId: RegExp;
    execute: (this: this, interaction: I, options: ComponentOptions) => Discord.Awaitable<void>;
}

type EventHandler<K extends keyof Discord.ClientEvents> = {
    name: K;
    once: boolean;
    execute: (this: EventHandler<K>, ...args: [...Discord.ClientEvents[K], EventOptions]) => Discord.Awaitable<void>;
}

export type Event = { [P in keyof Discord.ClientEvents]: EventHandler<P> }[keyof Discord.ClientEvents];