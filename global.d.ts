import type * as DiscordClientTypes from '@discord/types';
import type { Collection } from 'discord.js';

type StringKeys<T> = `${Exclude<keyof T, symbol>}`;

type GetStringKey<T, K extends StringKeys<T>> = K extends keyof T ? T[K] : T[number & keyof T];

type AutoPath<O, P extends string> =
    P extends `${infer A}.${infer B}`
        ? A extends StringKeys<O>
            ? `${A}.${AutoPath<GetStringKey<O, A>, B>}`
            : never
        : P extends StringKeys<O>
            ? P
            | `${P}.`
            : StringKeys<O>;

type GetPath<O, P extends string> =
    P extends `${infer A}.${infer B}`
        ? A extends StringKeys<O>
            ? GetPath<GetStringKey<O, A>, B>
            : never
        : P extends StringKeys<O>
            ? GetStringKey<O, P>
            : never;

declare global {

    interface Map<K, V> {

        /**
         * Get an array of the map values
         * @returns The values of this map as an array
         */

        toArray(this: this): V[];

        /**
         * Get a set of this map's keys
         * @returns The keys of this map as a set
         */

        toSet(this: this): Set<K>;

    }

    interface Array<T> {

        /**
         * Turn this array into a map
         * @param path The path to the key value as a string
         * @returns A map with the path value as the key and the array element as the value
         */

        toMap<P extends string>(this: this, path: AutoPath<T, P>): Map<GetPath<T, P>, T>;

        /**
         * Split this array into chunks
         * @param chunks The amount of chunks
         * @param balanced Whether to make the chunks balanced. If false will have an extra element with values that did not fit equally into the chunks. If true will try to balance the chunks as equally as possible, if not possible some chunks may be larger than others. By default true.
         * @returns A multidimensional array of the chunks
         */

        split(this: this, chunks: number, balanced?: boolean): T[][];

        /**
         * Turn this array into a generator.
         * This can be used to iterate over the values endlessly.
         * @returns The generator of this array
         */

        toGenerator(this: this): Generator<T, T, number>;

        /**
         * Get an array of the differences between each number in the array.
         * This function can only be used on number arrays!
         * @returns An array of the differences between each number, will be one less in length
         */

        difference(this: number[]): number[];

        /**
         * Get a random element of this array
         * @returns A random element from this array
         */

        random(this: this): T;

        /**
         * A shortcut function to get the last element of this array
         * @returns The last element of this array
         */

        last(this: this): T;

    }

    interface String {

        /**
         * Capitalizes first letter of each word in a string
         * @returns A string with each word of the string in capital
         */

        capitalize(this: string): string;

    }

    interface Math {

        /**
         * Calculates the percentage of a value in a value
         * @param value The value to calculate the percentage of
         * @param of_value The value to calculate the percentage from
         * @returns The percentage of `value` in `of_value`
         */

        percentage(value: number, of_value: number): number;

        /**
         * Returns the distance between the two numbers
         * @param x The first value
         * @param y The second value
         * @returns The difference between the two numbers
         */

        difference(x: number, y: number): number;

    }

    interface Date {

        /**
         * A typeguard, which checks whether this is a valid date
         * @returns A boolean value indicating whether this date is currently valid
         */

        isValid(this: this): this is Date;

    }

    interface Number {

        /**
         * Abbreviates a value equal to or above 1000. Can only abbreviate up to trillions
         * @param fractionDigits fraction digits of the value, by default 1
         * @returns The abbreviated value as a string
         */

        abbreviate(this: number, fractionDigits?: number): string;

    }

    interface JSON {

        /**
         * Convert JSON to CSV format
         * @param array An array of JSON objects
         * @param seperator The seperator to use in the CSV
         * @returns A string containing the formatted JSON
         */
        
        convertToCSV(array: Array<{ [key: string]: any }>, seperator?: string): string;

    }

}

declare module 'mongodb' {

    type Project<T extends Record<keyof P, any>, P> = {
        [Property in keyof P as P[Property] extends false ? never : Property]: T[Property];
    }

    type GeoNear<T> = T & {
        dist : {
            calculated: number;
            location: {
               type: "Point";
               coordinates: [number, number];
            };
        };
    }

}

declare module 'discord.js' {

    interface Client {
        chatCommands: Collection<string, DiscordClientTypes.SlashCommand>;
        menuCommands: Collection<string, DiscordClientTypes.ContextMenu>;
        components: Collection<string, DiscordClientTypes.Component>;
        cooldowns: Collection<string, Collection<string, Date>>;
    }

}