import { ObjectId, type Filter } from 'mongodb';
import { Formatters } from 'discord.js';
import { emojis } from '../config.json';

import type { Settings, AM4_Data } from '@typings/database';

type GameMode = "easy" | "realism";
type CodeType = "icao" | "iata";
type PaxSeat = 'Y' | 'J' | 'F';
type CargoSeat = 'H' | 'L';

/**
 * Represents the settings of a user
 * @constructor
 * @param user_id The ID of the user
 * @param settings The partial settings of the user
 */

export class User implements Settings.user {
    public id: string;
    public mode?: GameMode;
    public training: {
        fuel: number,
        co2: number,
        cargo_heavy: number,
        cargo_large: number
    };
    public salaries: {
        pilot: number;
        crew: number;
        engineer: number;
        tech: number;
    };
    public preference: {
        pax: [PaxSeat, PaxSeat, PaxSeat];
        cargo: [CargoSeat, CargoSeat];
    };
    public options: {
        show_warnings: boolean;
        show_tips: boolean;
        cost_index: number;
        fuel_price: number;
        co2_price: number;
        activity: number;
        code: CodeType;
    };
    constructor(user_id: string, settings?: Partial<Settings.user>) {
        this.id = user_id;
        if (settings?.mode) this.mode = settings.mode;
        this.training = settings?.training || {
            fuel: 0,
            co2: 0,
            cargo_heavy: 0,
            cargo_large: 0
        };
        this.salaries = settings?.salaries || {
            pilot: 200,
            crew: 150,
            engineer: 250,
            tech: 225
        };
        this.preference = settings?.preference ||  {
            pax: undefined,
            cargo: undefined
        };
        this.options = settings?.options || {
            show_warnings: true,
            show_tips: false,
            cost_index: 200,
            fuel_price: 500,
            co2_price: 125,
            activity: 18,
            code: undefined
        };
    }
    static readonly limits = {
        salaries: {
            pilot: [200, 10000] as const,
            crew: [150, 10000] as const,
            engineer: [250, 10000] as const,
            tech: [225, 10000] as const
        },
        training: {
            fuel: [0, 3] as const,
            co2: [0, 5] as const,
            cargo_heavy: [0, 6] as const,
            cargo_large: [0, 6] as const
        },
        options: {
            fuel_price: [0, 3000] as const,
            co2_price: [0, 200] as const,
            activity: [1, 24] as const,
            cost_index: [0, 200] as const
        }
    }
}

/**
 * A namespace containing utility functions for the Discord client
 */

export namespace Discord {

    /**
     * Convert JSON to CSV format
     * @param objectArray An array of JSON objects 
     * @returns The given JSON in CSV format
     */

    export function convertToCSV(array: object[], seperator = "|") {
        let content = '';
        const keys = Object.keys(array[0]);
        content += keys.join(seperator) + '\r\n';
        for (let i = 0; i < array.length; i++) {
            let line = '';
            for (const key of keys) {
                if (line !== '') line += seperator;
                line += array[i][key];
            }
            content += line;
            if ((i + 1) !== array.length) content += '\r\n';
        }
        return content;
    }

    /**
     * Format Y, J, F, L and H letters in a string to their representitive seat/load type emojis
     * @param string The string to format
     * @returns Formatted string, does not mutate the passed string
     */

    export function formatSeats(string: string) {
        const formattedString = string;
        return formattedString
        .replace(/Y/g, Formatters.formatEmoji(emojis.economy_seat))
        .replace(/J/g, Formatters.formatEmoji(emojis.business_seat))
        .replace(/F/g, Formatters.formatEmoji(emojis.first_seat))
        .replace(/L/g, Formatters.formatEmoji(emojis.cargo_small))
        .replace(/H/g, Formatters.formatEmoji(emojis.cargo_big));
    }

    /**
     * Format the ICAO and IATA codes based on preference
     * @param airport The airport data containing ICAO and IATA codes
     * @param type Whether to format the string as ICAO or IATA, if undefined will return both
     * @returns The formatted string
     */

    export function formatCode(airport: { icao: string, iata: string }, type?: "icao" | "iata") {
        return type
            ? airport[type].toUpperCase()
            : `${airport.iata.toUpperCase()}/${airport.icao.toUpperCase()}`;
    }

    /**
     * Get the next fuel & co2 price period as a Date
     * @param now The current Date
     * @returns The Date when the next fuel & co2 price period starts
     */

    export function nextPricePeriod(now: Date) {
        const date = new Date();
        const timestamp = now.getMinutes() < 30 
            ? date.setMinutes(30, 0, 0) 
            : date.setHours(now.getHours() + 1, 0, 0, 0);
        return new Date(timestamp);
    }

}

/**
 * A namespace containing utility functions for MongoDB
 */

export namespace MongoDB {

    /**
     * Create an airport filter query from a string
     * @param query The query string
     * @returns The filter query
     */

    export function createAirportFilter(query: string): Filter<AM4_Data.airport> {
        if (ObjectId.isValid(query)) {
            return new ObjectId(query);
        } else {
            return {
                $or: [
                    { icao: query.toLowerCase() },
                    { iata: query.toLowerCase() }
                ]
            };
        }
    }

    /**
     * Create a plane filter query from a string
     * @param query The query string
     * @returns The filter query
     */

    export function createPlaneFilter(query: string): Filter<AM4_Data.plane> {
        if (ObjectId.isValid(query)) {
            return new ObjectId(query);
        } else {
            return {
                $text: { 
                    $search: `"${query}"` 
                }
            };
        }
    }

    /**
     * Create an achievement filter query from a string
     * @param query The query string
     * @returns The filter query
     */

    export function createAchievementFilter(query: string): Filter<AM4_Data.achievement> {
        if (ObjectId.isValid(query)) {
            return new ObjectId(query);
        } else {
            return {
                $text: { 
                    $search: `"${query}"` 
                }
            };
        }
    }
    
}