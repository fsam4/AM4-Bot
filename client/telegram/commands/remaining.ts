import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import { Markup } from 'telegraf';

import type { Command } from '../types';

const keyboard = Markup.inlineKeyboard([Markup.button.callback("🔄 Refresh", "refresh")]);

const command: Command = {
    name: 'remaining',
    cooldown: 0,
    description: 'View the amount of API requests remaining for today',
    help: "Create polls or quizes by using this command",
    async execute(ctx, { rest }) {
        const locale = ctx.from.language_code || "en";
        const content = rest.am4.lastRequest ? `${rest.am4.requestsRemaining.toLocaleString(locale)} requests remaining. Last updated ${formatDistanceToNowStrict(rest.am4.lastRequest, { addSuffix: true })}` : "No requests have been made since last restart...";
        await ctx.replyWithMarkdown(content, keyboard);
    },
    actions: [
        {
            value: "refresh",
            async execute(ctx, { rest }) {
                const locale = ctx.from.language_code || "en";
                const content = rest.am4.lastRequest ? `${rest.am4.requestsRemaining.toLocaleString(locale)} requests remaining. Last updated ${formatDistanceToNowStrict(rest.am4.lastRequest, { addSuffix: true })}` : "No requests have been made since last restart...";
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