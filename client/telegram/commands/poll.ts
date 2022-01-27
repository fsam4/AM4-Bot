import { Markup } from 'telegraf';

import type { Command } from '@telegram/types';

const command: Command = {
    name: 'poll',
    cooldown: 0,
    description: 'Create polls',
    async execute(ctx) {
        const keyboard = Markup.keyboard([
            Markup.button.pollRequest('Create a poll', 'regular'),
            Markup.button.pollRequest('Create a quiz', 'quiz')
        ]).oneTime();
        await ctx.reply('Creating a poll...', keyboard);
    },
    actions: [],
    scenes: []
}

export = command;