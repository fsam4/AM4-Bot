import pug from 'pug';

import type { Command } from '@telegram/types';

const command: Command = {
    name: 'start',
    description: 'Bot information',
    async execute(ctx, { bot, database }) {
        console.log(`/start was used in ${ctx.chat.id}`);
        const commands = await bot.telegram.getMyCommands();
        const compile = pug.compileFile("client/telegram/layouts/start.pug");
        const discordInviteUrl = process.env.DISCORD_SERVER_INVITE;
        if (discordInviteUrl === undefined) throw new Error("DISCORD_SERVER_INVITE must be provided!");
        const telegramInviteUrl = process.env.TELEGRAM_CHAT_INVITE;
        if (telegramInviteUrl === undefined) throw new Error("TELEGRAM_CHAT_INVITE must be provided!");
        const content = compile({ commands, discordInviteUrl, telegramInviteUrl, ctx });
        await ctx.replyWithHTML(content);
    },
    actions: [],
    scenes: []
}

export = command;