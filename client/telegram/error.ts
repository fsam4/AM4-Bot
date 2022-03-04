import ClientError from '../error';

import type { ParseMode } from 'typegram';
import type { Context } from 'telegraf';

const message = "An unknown error occured. Please report this in [AM4 Bot Telegram group chat](https://t.me/joinchat/mWoOI4FP6PcxMTRk) or in [the Air France KLM Discord server](https://discord.gg/ZNYXSVNKb9)."

/**
 * A class representing a Telegram client error.
 * @constructor
 * @param message - The error message
 * @param parse_mode - The parse mode to use on the error message
 */

export default class TelegramClientError extends ClientError {

    public constructor(message: string, private parse_mode = "Markdown" as ParseMode) {
        super(message);
    }

    /**
     * Send the error as a reply
     * @param ctx - The context to reply to
     */

    async send(ctx: Context) {
        await ctx.reply(this.message, { parse_mode: this.parse_mode })
        .catch(console.error);
    }

    /**
     * Send the error as an answer to a callback query
     * @param ctx - The callback query context to answer to
     */

    async answerCbQuery(ctx: Context) {
        await ctx.answerCbQuery(this.message, { show_alert: true })
        .catch(console.error);
    }

    /**
     * Send an unknown error reply
     * @param ctx - The context to reply to
     */

    static async sendUnknownError(ctx: Context) {
        await ctx.replyWithMarkdown(message)
        .catch(console.error)
    }

}