import type { EventEmitter } from 'events';

export type ListenerSignature<L> = {
    [E in keyof L]: (...args: any[]) => any;
};

export type DefaultListener = {
    [key: string]: (...args: any[]) => any;
};

/**
 * A typed version of EventEmitter that takes in an interface of the listeners and applies their types to each methods and properties of EventEmitter.
 * Exports the EventEmitter from `node:events` with types overridden, so it functions the same as the default EventEmitter.
 */

export class TypedEmitter<L extends ListenerSignature<L> = DefaultListener> {
    constructor(...args: ConstructorParameters<typeof EventEmitter>);
    static defaultMaxListeners: number;
    addListener<U extends keyof L>(event: U, listener: L[U]): this;
    prependListener<U extends keyof L>(event: U, listener: L[U]): this;
    prependOnceListener<U extends keyof L>(event: U, listener: L[U]): this;
    removeListener<U extends keyof L>(event: U, listener: L[U]): this;
    removeAllListeners(event?: keyof L): this;
    once<U extends keyof L>(event: U, listener: L[U]): this;
    on<U extends keyof L>(event: U, listener: L[U]): this;
    off<U extends keyof L>(event: U, listener: L[U]): this;
    emit<U extends keyof L>(event: U, ...args: Parameters<L[U]>): boolean;
    eventNames<U extends keyof L>(): U[];
    listenerCount(type: keyof L): number;
    listeners<U extends keyof L>(type: U): L[U][];
    rawListeners<U extends keyof L>(type: U): L[U][];
    getMaxListeners(): number;
    setMaxListeners(n: number): this;
}