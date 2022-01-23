import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import addMonths from 'date-fns/addMonths';
import pug from 'pug';

import type { Telegram, AM4_Data } from '@typings/database';
import type { Message, User } from 'typegram';
import type { Command } from '../types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const commandName = "achievement";

const command: Command<Scenes.SceneContext, never, SceneContext> = {
    name: commandName,
    cooldown: 10,
    description: 'Seach for an achievement',
    help: "With this command you can search for information about achievements. The command has one option and it's only required achievement is `<achievement>` which is the name of the achievement. This command can only be used in direct messages with the bot!",
    async execute(ctx) {
        if (ctx.chat.type !== 'private') {
            await ctx.reply('This command can only be used in DMs...');
        } else {
            await ctx.scene.enter('search:achievement');
        }
    },
    actions: [],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('search:achievement', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database }) {
                const keyboards = database.telegram.collection<Telegram.keyboard>('Keyboards');
                const achievements = database.am4.collection<AM4_Data.achievement>('Achievements');
                const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
                this.scene.use((ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    return next();
                });
                this.scene.enter(async (ctx) => {
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: commandName });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Now type the name of the achievement...\nFormat: `<achievement>`\nExample: `airbus`'];
                    if (keyboard) {
                        const columns = keyboard.input.length > 1 ? Math.trunc(keyboard.input.length / 2) : 1;
                        const markup = Markup.keyboard(keyboard.input, { columns }).oneTime(true);
                        content.push(markup);
                    }
                    await ctx.replyWithMarkdown(...content);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const achievement = await achievements.findOne({ $text: { $search: `"${ctx.message.text}"` } });
                        if (!achievement) throw new TelegramClientError(`No achievement *${ctx.message.text}* was found...`);
                        if (achievement.route.length) {
                            const airports = await airportCollection.aggregate<AM4_Data.airport>([
                                {
                                    $match: { 
                                        _id: { $in: achievement.route } 
                                    }
                                },
                                {
                                    $addFields: {
                                        index: {
                                            $indexOfArray: [achievement.route, "$_id"]
                                        }
                                    }
                                },
                                {
                                    $sort: {
                                        index: 1
                                    }
                                },
                                {
                                    $project: {
                                        index: false
                                    }
                                }
                            ]).toArray();
                            // @ts-expect-error: overwriting route to string for the pug compiler
                            achievement.route = airports.map(airport => `${airport.city} (${airport.icao}/${airport.iata})`);
                        }
                        const compile = pug.compileFile('client/telegram/layouts/achievement.pug');
                        const reply = compile({ achievement });
                        if (achievement.image) {
                            await ctx.replyWithPhoto({ url: achievement.image }, {
                                caption: reply,
                                parse_mode: 'HTML'
                            });
                        } else {
                            await ctx.replyWithHTML(reply);
                        }
                    }
                    catch(error) {
                        if (error instanceof TelegramClientError) {
                            await error.send(ctx);
                        } else {
                            console.error(error);
                            await TelegramClientError.sendUnknownError(ctx);
                        }
                    }
                    finally {
                        await keyboards.bulkWrite([
                            {
                                updateOne: {
                                    filter: { id: ctx.from.id, command: commandName },
                                    upsert: true,
                                    update: {
                                        $addToSet: {
                                            input: ctx.message.text
                                        },
                                        $set: {
                                            expireAt: addMonths(Date.now(), 1)
                                        }
                                    }
                                }
                            },
                            {
                                updateOne: {
                                    filter: { id: ctx.from.id, command: commandName },
                                    update: {
                                        $push: {
                                            input: {
                                                $each: [],
                                                $slice: -6
                                            }
                                        }
                                    }
                                }
                            }
                        ]);
                    }
                });
            }
        }
    ]
}

export = command;