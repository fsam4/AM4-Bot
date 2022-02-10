import { fetch } from 'undici';

import type { Command } from '@telegram/types';

interface Fact {
    id: string;
    text: string;
    source: string;
    source_url: string;
    language: 'en' | 'de';
    permalink: string;
}

const command: Command = {
    name: 'fact',
    cooldown: 10,
    description: 'This command generates a random fact.',
    async execute(ctx) {
        const fact = await fetch('https://uselessfacts.jsph.pl/random.json?language=en').then(res => res.json()) as Fact;
        if (!fact) {
            await ctx.reply('Something went wrong with finding a random fact...');
            return;
        };
        await ctx.replyWithMarkdown(`${fact.text} *(${fact.source})*`);
    },
    actions: [],
    scenes: []
}

export = command;