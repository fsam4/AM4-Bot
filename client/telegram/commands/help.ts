import { Markup, Scenes } from 'telegraf';
import path from 'path';
import fs from 'fs';

import type { Message, User } from 'typegram';
import type { Context } from 'telegraf';
import type { Command } from '../types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('🔍 Command', 'help:command'),
    Markup.button.callback('📰 News', 'help:news')
]);

const text = [
    '🔍: Get help with an invidual command',
    '📰: Read news about the latest update',
    '\n*Using commands:*',
    'When using commands',
    '• `<...>`: stands for a required argument',
    '• `(...)`: stands for an optional argument',
    '• `,...`: stands for several arguments of same type seperated by commas',
    '• Seperate every argument with a comma!',
    '• Every command has an exmaple. Try that if you have problems.',
    '\n*Useful links:*',
    '• AM4 Bot\'s official Discord: https://discord.gg/f8WHuRX',
    '• AM4 Bot\'s Telegram group chat: https://t.me/joinchat/mWoOI4FP6PcxMTRk'
];

const news = [
    '*AM4 Telegram Bot V2.5*',
    '• /contributed has been changed to /member',
    '• Charts have been updated and improved',
    '• You can now use /remaining to check the amount of AM4 API requests remaining for today',
    '• Many other minor improvements have been made everywhere',
    '• /joke has been removed due to it being broken'
];

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: 'help',
    cooldown: 0,
    description: 'Get help with using the bot & commands',
    async execute(ctx) {
        await ctx.replyWithMarkdown(`*AM4 Telegram Bot*\n${text.join('\n')}`, keyboard)
    },
    actions: [
        {
            value: /help(?=:(command|news|menu))/,
            async execute(ctx) {
                const [_, section] = (<string>ctx.callbackQuery["data"]).split(":");
                switch(section) {
                    case "command": {
                        await ctx.scene.enter('commands');
                        break;
                    }
                    case "news": {
                        const button = Markup.button.callback('🏠 Back to menu', 'help:menu');
                        const options = Markup.inlineKeyboard([button]);
                        await ctx.editMessageText(news.join('\n'), { 
                            parse_mode: 'Markdown',
                            reply_markup: options.reply_markup
                        });
                        break;
                    }
                    default: {
                        await ctx.editMessageText(`*AM4 Telegram Bot*\n${text.join('\n')}`, {
                            parse_mode: 'Markdown',
                            reply_markup: keyboard.reply_markup
                        });
                    }
                }
            }
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('commands', <BaseSceneOptions>{ ttl: 60000 }),
            async register() {
                const files = fs.readdirSync(path.join(process.cwd(), 'client', 'telegram', 'commands')).filter(file => file.endsWith('.js'));
                const markup = Markup.inlineKeyboard([Markup.button.callback('🏠 Back to menu', 'back')]);
                this.scene.use(async (ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    return next();
                });
                for await (const file of files) {
                    const command: Command = await import(`./${file}`);
                    this.scene.command(command.name, async (ctx) => {
                        if (ctx.scene.session.user.id !== ctx.from.id) return;
                        if (!command.help) return await ctx.reply('Could not find any help for this command...');
                        await ctx.deleteMessage().catch(() => undefined);
                        const message = ctx.scene.session.message;
                        await ctx.tg.editMessageText(message.chat.id, message.message_id, message.forward_signature, `/${command.name}\n${command.help}`, {
                            reply_markup: markup.reply_markup,
                            parse_mode: 'Markdown'
                        });
                        await ctx.scene.leave();
                    });
                }
                this.scene.enter(async (ctx) => {
                    const commands = await ctx.getMyCommands();
                    const content = `*Click the command that you would like to get help with.*\n${commands.map(({ command, description }) => `/${command} - ${description}`).join('\n')}`;
                    ctx.scene.session.message = await ctx.editMessageText(content, {
                        reply_markup: markup.reply_markup,
                        parse_mode: 'Markdown'
                    }) as Message.TextMessage;
                });
                this.scene.action('back', async (ctx) => {
                    await ctx.scene.leave();
                    await ctx.editMessageText(`*AM4 Telegram Bot*\n${text.join('\n')}`, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard.reply_markup
                    });
                });
            }
        }
    ]
}

export = command;