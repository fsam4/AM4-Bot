import type { Command } from '../types';

const command: Command = {
    name: 'start',
    description: 'Bot information',
    async execute(ctx, { bot }) {
        const commands = await bot.telegram.getMyCommands();
        const txt = "Hello! AM4 Telegram Bot is a chat bot that can bring your game stats into Telegram. AM4 Bot can do various game related calculations, find routes, form charts & graphs and more. You can also play aviation related quiz games! You can join AM4 Bot on Discord by joining https://discord.gg/f8WHuRX. If you need help or want to report bugs join https://t.me/joinchat/mWoOI4FP6PcxMTRk.";
        await ctx.reply(`${txt}\n\nAM4 Bot has ${commands.length} different commands that include many features and choices. Get started by checking out /help. You can from there get help with commands! All AM4 Bot commands will pop up if you type / in the chat.`);
        console.log(`/start was used in ${ctx.chat.id}`);
    },
    actions: [],
    scenes: []
}

export = command;