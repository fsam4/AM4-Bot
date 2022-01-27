import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import { Markup } from 'telegraf';

import type { Command } from '@telegram/types';

const keyboard = Markup.inlineKeyboard([Markup.button.callback("🔄 Refresh", "refresh")]);

const command: Command = {
    name: 'remaining',
    cooldown: 0,
    description: 'View the amount of API requests remaining for today',
    async execute(ctx, { rest }) {
        const locale = ctx.from.language_code || "en";
        const content = rest.lastRequest ? `${rest.requestsRemaining.toLocaleString(locale)} requests remaining. Last updated ${formatDistanceToNowStrict(rest.lastRequest, { addSuffix: true })}` : "No requests have been made since last restart...";
        await ctx.replyWithMarkdown(content, keyboard);
    },
    actions: [
        {
            value: "refresh",
            async execute(ctx, { rest }) {
                const locale = ctx.from.language_code || "en";
                const content = rest.lastRequest ? `${rest.requestsRemaining.toLocaleString(locale)} requests remaining. Last updated ${formatDistanceToNowStrict(rest.lastRequest, { addSuffix: true })}` : "No requests have been made since last restart...";
                await ctx.answerCbQuery();
                await ctx.editMessageText(content, {
                    parse_mode: "Markdown",
                    reply_markup: keyboard.reply_markup
                });
            }
        }
    ],
    scenes: []
}

export = command;