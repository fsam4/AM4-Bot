import { Markup, Scenes } from 'telegraf';
import matter from 'gray-matter';
import path from 'path';
import fs from 'fs';

import type { Message, User } from 'typegram';
import type { Context } from 'telegraf';
import type { Command } from '@telegram/types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const documentDirectory = path.join(process.cwd(), "documents", "markdown");

const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('🔍 Command', 'help:command'),
    Markup.button.callback('📰 News', 'help:news'),
    Markup.button.callback('👮 Privacy Policy', 'help:privacy')
]);

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: 'help',
    cooldown: 0,
    description: 'Get help with using the bot & commands',
    async execute(ctx) {
        const fullPath = path.join(documentDirectory, "help-menu.md");
        const fileContents = fs.readFileSync(fullPath, "utf8");
        const matterResult = matter(fileContents);
        await ctx.replyWithMarkdown(`*${matterResult.data.title}*\n${matterResult.content}`, {
            parse_mode: matterResult.data.parse_mode,
            ...keyboard
        });
    },
    actions: [
        {
            value: /help(?=:(command|news|menu|privacy))/,
            async execute(ctx) {
                const [_, section] = ctx.callbackQuery.data.split(":");
                await ctx.answerCbQuery();
                switch(section) {
                    case "command": {
                        await ctx.scene.enter('commands');
                        break;
                    }
                    case "privacy":
                    case "news": {
                        const button = Markup.button.callback('🏠 Back to menu', 'help:menu');
                        const options = Markup.inlineKeyboard([button]);
                        const fullPath = path.join(documentDirectory, section === "news" ? "update.md" : "privacy-policy.md");
                        const fileContents = fs.readFileSync(fullPath, "utf8");
                        const matterResult = matter(fileContents);
                        await ctx.editMessageText(`*${matterResult.data.title}*\n${matterResult.content}`, { 
                            parse_mode: matterResult.data.parse_mode,
                            ...options
                        });
                        break;
                    }
                    default: {
                        const fullPath = path.join(documentDirectory, "help-menu.md");
                        const fileContents = fs.readFileSync(fullPath, "utf8");
                        const matterResult = matter(fileContents);
                        await ctx.replyWithMarkdown(`*${matterResult.data.title}*\n${matterResult.content}`, {
                            parse_mode: matterResult.data.parse_mode,
                            ...keyboard
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
                const markup = Markup.inlineKeyboard([Markup.button.callback('🏠 Back to menu', 'back')]);
                const commandDirectory = path.join(process.cwd(), "client", "telegram", "commands");
                const fileNames = fs.readdirSync(commandDirectory).filter(fileName => fileName.endsWith(".js"));
                this.scene.use(async (ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    return next();
                });
                for (const fileName of fileNames) {
                    const command: Command = await import(`./${fileName}`);
                    this.scene.command(command.name, async (ctx) => {
                        if (ctx.scene.session.user.id !== ctx.from.id) return;
                        if (!command.helpFileContent) return ctx.reply('Could not find any help section for this command...');
                        await ctx.deleteMessage().catch(() => void 0);
                        const matterResult = matter(command.helpFileContent);
                        const message = ctx.scene.session.message;
                        await ctx.tg.editMessageText(message.chat.id, message.message_id, message.forward_signature, `/${matterResult.data.commandName}\n${matterResult.content}`, {
                            parse_mode: "MarkdownV2",
                            ...markup
                        });
                        await ctx.scene.leave();
                    });
                }
                this.scene.enter(async (ctx) => {
                    const commands = await ctx.telegram.getMyCommands();
                    const content = `*Click the command that you would like to get help with.*\n${commands.map(({ command, description }) => `/${command} - ${description}`).join('\n')}`;
                    ctx.scene.session.message = await ctx.editMessageText(content, { ...markup, parse_mode: 'Markdown' }) as Message.TextMessage;
                });
                this.scene.action('back', async (ctx) => {
                    await ctx.scene.leave();
                    await ctx.answerCbQuery();
                    const fullPath = path.join(documentDirectory, "help-menu.md");
                    const fileContents = fs.readFileSync(fullPath, "utf8");
                    const matterResult = matter(fileContents);
                    await ctx.editMessageText(`*${matterResult.data.title}*\n${matterResult.content}`, {
                        parse_mode: matterResult.data.parse_mode,
                        ...keyboard
                    });
                });
            }
        }
    ]
}

export = command;