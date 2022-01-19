import TelegramClientError from '../error';
import { Scenes } from 'telegraf';
import fetch from 'node-fetch';

import type { Message, User } from 'typegram';
import type { Command } from '../types';

interface Definitions {
    list: Array<{
        definition: string;
        permalink: string;
        thumbs_up: number;
        sound_urls: string[];
        author: string;
        word: string;
        defid: number;
        current_vote: any;
        written_on: Date;
        example: string;
        thumbs_down: number;
    }>
}

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const definitionURL = (term: string) => `https://www.urbandictionary.com/define.php?${new URLSearchParams({ term })}`;
const replaceHyperlinks = (s: string) => `[${s}](${definitionURL(s)})`;
const hyperlink = /\[\w{1,}\]/g;

const command: Command<Scenes.SceneContext, never, SceneContext> = {
    name: 'urban',
    cooldown: 10,
    description: 'Search the urban dictionary',
    help: "This command can be used to look up a sentence, phrase or a word from the urban dictionary. After using the command type whatever you would like to search for. The bot returns the most popular result.",
    async execute(ctx) {
        await ctx.scene.enter('urban');
    },
    actions: [],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('urban', <BaseSceneOptions>{ ttl: 120000 }),
            async register() {
                this.scene.use((ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    return next();
                })
                this.scene.enter(async (ctx) => {
                    await ctx.reply('Type what you would like to search from the urban dictionary...');
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const query = new URLSearchParams({ term: ctx.message.text });
                        const { list }: Definitions = await fetch(`https://api.urbandictionary.com/v0/define?${query}`).then((response) => response.json());
                        if (!list.length) throw new TelegramClientError(`No results found for *${ctx.message.text}*...`);
                        const [answer] = list;
                        answer.definition = answer.definition.replace(hyperlink, replaceHyperlinks);
                        answer.example = answer.example.replace(hyperlink, replaceHyperlinks);
                        const bu = (text: string) => `<a><u>${text}</u></a>`;
                        await ctx.replyWithHTML(`${bu('Definition')}\n${answer.definition.trim()}\n\n${bu('Example')}\n${answer.example.trim()}`);
                    }
                    catch(error) {
                        if (error instanceof TelegramClientError) {
                            await error.send(ctx);
                        } else {
                            console.error(error);
                            await TelegramClientError.sendUnknownError(ctx);
                        }
                    }
                });
            }
        }
    ]
}

export = command;