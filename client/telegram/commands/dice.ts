import type { Command } from '../types';

const command: Command = {
    name: 'dice',
    cooldown: 0,
    description: 'Roll a dice',
    async execute(ctx) {
        await ctx.replyWithDice();
    },
    actions: [],
    scenes: []
}

export = command;