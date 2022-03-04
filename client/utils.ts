import { Formatters, type MessageAttachment, type Interaction, type BaseCommandInteraction, type CommandInteraction, type ContextMenuInteraction, type UserContextMenuInteraction, type MessageContextMenuInteraction, type AutocompleteInteraction, type MessageComponentInteraction, type ButtonInteraction, type SelectMenuInteraction } from 'discord.js';
import { ObjectId, type Filter } from 'mongodb';
import { emojis } from '../config.json';
import Route from '../src/classes/route';

import getMinutes from 'date-fns/getMinutes';
import addHours from 'date-fns/addHours';
import setTime from 'date-fns/set';

import type * as TelegramClientTypes from '@telegram/types';
import type { Context, Scenes } from 'telegraf';
import type { Message } from 'typegram';
import type { AM4 } from '@typings/database';

type AirportLike = { icao: string, iata: string };

const seatEmojis = {
    Y: emojis.economy_seat,
    J: emojis.business_seat,
    F: emojis.first_seat,
    L: emojis.cargo_small,
    H: emojis.cargo_big
};

const seat = new RegExp(`(${Object.keys(seatEmojis).join("|")})`, "g");
const replaceWithEmoji = (key: keyof typeof seatEmojis) => Formatters.formatEmoji(seatEmojis[key]);

/**
 * A namespace containing utility functions for the Discord client
 */

export namespace Discord {

    /**
     * Format Y, J, F, L and H letters in a string to their representitive seat/load type emojis
     * @param string - The string to format
     * @returns Formatted string, does not mutate the passed string
     */

    export function formatSeats(string: string) {
        const formattedString = string;
        return formattedString.replace(seat, replaceWithEmoji);
    }

    /**
     * Format the ICAO and IATA codes based on preference
     * @param airport - The airport data containing ICAO and IATA codes
     * @param type - Whether to format the string as ICAO or IATA, if undefined will return both
     * @returns The formatted string
     */

    export function formatCode(airport: AirportLike, type?: keyof AirportLike) {
        return (type && type in airport)
            ? airport[type].toUpperCase()
            : `${airport.iata.toUpperCase()}/${airport.icao.toUpperCase()}`;
    }

    /**
     * Get the next fuel & co2 price period as a Date
     * @param now - The current Date
     * @returns The Date when the next fuel & co2 price period starts
     */

    export function nextPricePeriod(now: Date | number) {
        const isHalfPast = getMinutes(now) >= 30;
        const date = setTime(now, {
            minutes: isHalfPast ? 0 : 30,
            seconds: 0,
            milliseconds: 0
        });
        return isHalfPast ? addHours(date, 1) : date;
    }

    /**
     * Create an attachment URL out of a message attachment or a file name
     * @param file - A message attachment or file name
     * @returns The Discord attachment URL
     */

    export function createAttachmentUrl(file: string | MessageAttachment): `attachment://${string}` {
        const fileName = typeof file === "string" ? file : file.name;
        return `attachment://${fileName}`;
    }

    function isCachedInteraction(interaction: Interaction): interaction is Interaction<"cached"> {
        return interaction.inCachedGuild() || !interaction.inGuild();
    }

    export const isCachedCommandInteraction = isCachedInteraction as (interaction: CommandInteraction) => interaction is CommandInteraction<"cached">;
    export const isCachedAutocompleteInteraction = isCachedInteraction as (interaction: AutocompleteInteraction) => interaction is AutocompleteInteraction<"cached">;
    export const isCachedUserContextMenuInteraction = isCachedInteraction as (interaction: UserContextMenuInteraction) => interaction is UserContextMenuInteraction<"cached">;
    export const isCachedMessageContextMenuInteraction = isCachedInteraction as (interaction: MessageContextMenuInteraction) => interaction is MessageContextMenuInteraction<"cached">;
    export const isCachedMessageComponentInteraction = isCachedInteraction as (interaction: MessageComponentInteraction) => interaction is MessageComponentInteraction<"cached">;
    export const isCachedSelectMenuInteraction = isCachedInteraction as (interaction: SelectMenuInteraction) => interaction is SelectMenuInteraction<"cached">;
    export const isCachedButtonInteraction = isCachedInteraction as (interaction: ButtonInteraction) => interaction is ButtonInteraction<"cached">;

}

type ActionContext = Scenes.SceneContext & { callbackQuery: TelegramClientTypes.DataCallbackQuery };

/**
 * A namespace containing utility functions for the Telegram client
 */

export namespace Telegram {

    /**
     * Delete a message after a timeout
     * @param ctx - The context to delete the message from
     * @param message - The message that was sent
     * @param timeouts - The timeout Map to remove the timeout from
     */

    export function deleteMessage(ctx: Context, message: Message.TextMessage, timeouts: Map<number, NodeJS.Timeout>) {
        timeouts.delete(message.message_id);
        ctx.telegram.deleteMessage(message.chat.id, message.message_id).catch(() => void 0);
    }

    /**
     * A default action execute function that clears the timeouts for the message, enters the scene and answer the callback query
     * @param ctx - The context to answer to
     * @param options - The options for the action
     */

    export async function executeAction(ctx: ActionContext, { timeouts }: TelegramClientTypes.CommandOptions) {
        if (timeouts.has(ctx.message.message_id)) {
            const timeout = timeouts.get(ctx.message.message_id);
            clearTimeout(timeout);
            timeouts.delete(ctx.message.message_id);
        }
        await ctx.scene.enter(ctx.callbackQuery.data);
        await ctx.answerCbQuery();
    }

}

type Coordinates = [number, number];

/**
 * A namespace containing utility functions for MongoDB
 */

export namespace MongoDB {

    /**
     * Create an airport filter query from a string
     * @param query - The query string
     * @returns The filter query
     */

    export function createAirportFilter(query: string): Filter<AM4.Airport> {
        if (ObjectId.isValid(query)) {
            return { _id: new ObjectId(query) };
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
     * Create a text filter query from a string
     * @param query - The query string
     * @returns The filter query
     */

    export function createTextFilter<T>(query: string): Filter<T> {
        if (ObjectId.isValid(query)) {
            return { _id: new ObjectId(query) };
        } else {
            return {
                $text: {
                    $search: `"${query}"`
                }
            };
        }
    }

    /**
     * Create a location sphere from a pair of coordinates
     * @param a - The first coordinates
     * @param b - The second coordinates
     * @returns The center point of the coordinates with the radians of the sphere
     */

    export function createLocationSphere(a: Coordinates, b: Coordinates) {
        const centerPoint: Coordinates = [
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2
        ];
        const { distance } = Route.preciseDistance(centerPoint, a || b);
        return [centerPoint, distance / 6378.1] as const;
    }

    /**
     * Create location box upper left and bottom right coordinates
     * @param a - The first coordinates
     * @param b - The second coordinates
     * @returns The upper left coordinate first and the bottom right coordinate second
     */

    export function createLocationBox(a: Coordinates, b: Coordinates) {
        if (a[0] > b[0]) {
            if (a[1] < b[1]) {
                return [a, b];
            } else {
                return [
                    [a[0], b[1]],
                    [b[0], a[1]]
                ];
            }
        } else {
            if (b[1] < a[1]) {
                return [b, a];
            } else {
                return [
                    [b[0], a[1]],
                    [a[0], b[1]]
                ];
            }
        }
    }

}