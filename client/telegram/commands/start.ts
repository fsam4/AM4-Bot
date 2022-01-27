import pug from 'pug';

import type { Command } from '@telegram/types';

const command: Command = {
    name: 'start',
    description: 'Bot information',
    async execute(ctx, { bot, database }) {
        console.log(`/start was used in ${ctx.chat.id}`);
        const commands = await bot.telegram.getMyCommands();
        const compile = pug.compileFile("client/telegram/layouts/start.pug");
        const content = compile({ commands });
        await ctx.replyWithHTML(content);
    },
    actions: [],
    scenes: []
}

export = command;