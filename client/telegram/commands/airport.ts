import { Telegram as Utils } from '../../utils';
import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import pug from 'pug';
import fs from 'fs';

import type { Command, DataCallbackQuery } from '@telegram/types';
import type { Message, User } from 'typegram';
import type { AM4, GeoNear } from '@typings/database';
import type { GameMode } from '@typings/am4-api';
import type { Context } from 'telegraf';

interface SceneSession extends Scenes.SceneSessionData {
    pages: Generator<string, string, number>;
    message: Message.TextMessage;
    gameMode;
    input: string;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const sessionHandler = (ctx: SceneContext, next: () => void) => {
    ctx.scene.session.user ||= ctx.from;
    return next();
};

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: 'airport',
    cooldown: 20,
    description: 'Search for airports',
    helpFileContent: fs.readFileSync("./documents/markdown/airport.md", "utf8"),
    async execute(ctx, { timeouts }) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🔍 Filter', 'filter:airport'),
            Markup.button.callback('📍 Search', 'search:airport'),
            Markup.button.callback('💲 Sell plane', 'sell:airport')
        ], { columns: 2 });
        const reply_text = [
            "🔍: Find airports based on input criteria",
            "📍: Search for a specific airport",
            "💲: Search for the best airport to sell a plane"
        ];
        await ctx.replyWithMarkdown(reply_text.join('\n'), keyboard)
        .then(message => {
            const timeout = setTimeout(Utils.deleteMessage, 120000, ctx, message, timeouts);
            timeouts.set(message.message_id, timeout);
        });
    },
    actions: [
        {
            value: /(filter|search|sell)(?=:airport)/,
            execute: Utils.executeAction
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('filter:airport', <BaseSceneOptions>{ ttl: 600000 }),
            async register({ database }) {
                const airportCollection = database.am4.collection<AM4.Airport>('Airports');
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => void 0);
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'delete')]);
                    await ctx.replyWithMarkdown('Type the market, runway and region sepearted by commas!\nFormat: `<min_market>, <min_runway>, <city/country>`\nExample: `90, 5000, brazil`', action_keyboard);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const locale = ctx.from.language_code || 'en';
                    ctx.scene.session.input = ctx.message.text;
                    try {
                        const args = ctx.message.text.split(',').map(s => s.trim());
                        let min_market = parseInt(args[0]);
                        let min_runway = parseInt(args[1]);
                        if (isNaN(min_market)) throw new TelegramClientError("The market percentage needs to be a valid number!");
                        if (isNaN(min_runway)) throw new TelegramClientError("The runway length needs to be a valid number!");
                        min_market ??= 89;
                        min_runway ??= 0;
                        if (min_market > 90 || min_market < 30) throw new TelegramClientError('The market percentage needs to be between 30-90%!');
                        const region = args[2] || 'unknown';
                        const airports = await airportCollection.find({
                            $and: [
                                { market: { $gte: min_market } },
                                { runway: { $gte: min_runway } },
                                {
                                    $or: [
                                        { country: region.toLowerCase() },
                                        { country_code: region.toLowerCase() },
                                        { city: region.toLowerCase() }
                                    ]
                                }
                            ]
                        }).limit(100).toArray();
                        if (!airports.length) throw new TelegramClientError('No airports were found with that criteria...');
                        const compile = pug.compileFile('client/telegram/layouts/airport.pug');
                        const pages = airports.map(airport => compile({ airport, locale }));
                        const content: Parameters<typeof ctx.replyWithHTML> = [pages[0]];
                        const markup = Markup.inlineKeyboard([
                            Markup.button.callback('▶️', 'next'),
                            Markup.button.callback('🗑️', 'delete')
                        ]);
                        if (pages.length > 1) content.push(markup);
                        const msg = await ctx.replyWithHTML(...content);
                        if (pages.length === 1) await ctx.scene.leave();
                        ctx.scene.session.pages = pages.toGenerator();
                        ctx.scene.session.message = msg;
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
                this.scene.action(/next|prev/, async (ctx) => {
                    const message = ctx.update.callback_query.message;
                    if (message.message_id !== ctx.scene.session.message.message_id || ctx.from.id !== ctx.scene.session.user.id) return;
                    const option = (<DataCallbackQuery>ctx.callbackQuery).data;
                    const page = option === "next" ? ctx.scene.session.pages.next(1) : ctx.scene.session.pages.next(-1);
                    const pages = [...ctx.scene.session.pages];
                    const currentPage = pages.findIndex(text => text === page.value);
                    await ctx.answerCbQuery(`Page ${currentPage + 1} of ${pages.length}`);
                    const markup = Markup.inlineKeyboard([
                        Markup.button.callback('◀️', 'prev'),
                        Markup.button.callback('▶️', 'next'),
                        Markup.button.callback('🗑️', 'delete')
                    ]);
                    await ctx.editMessageText(page.value, { 
                        parse_mode: 'HTML', 
                        reply_markup: markup.reply_markup
                    })
                    .catch(ctx.scene.leave);
                });
                this.scene.action('delete', async (ctx) => {
                    await ctx.answerCbQuery();
                    await ctx.deleteMessage().catch(() => void 0);
                    await ctx.scene.leave();
                });
            }
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('search:airport', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database }) {
                const airportCollection = database.am4.collection<AM4.Airport>('Airports');
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => void 0);
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.replyWithMarkdown('Type the ICAO, IATA or id of the airport...\nFormat: `<icao|iata|id>`\nExample: `efhk`', action_keyboard);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const locale = ctx.from.language_code || 'en';
                    await ctx.scene.leave();
                    try {
                        const airport = await airportCollection.findOne({
                            $or: [
                                { iata: ctx.message.text.toLowerCase() },
                                { icao: ctx.message.text.toLowerCase() }
                            ]
                        });
                        const title = `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.iata.toUpperCase()}(${airport.icao.toUpperCase()}))`;
                        const content = `Runway: ${airport.runway.toLocaleString(locale)} ft\nMarket: ${airport.market}%`;
                        await ctx.replyWithVenue(airport.location.coordinates[1], airport.location.coordinates[0], title, content);
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
                this.scene.action('exit', async (ctx) => {
                    await ctx.answerCbQuery();
                    await ctx.deleteMessage().catch(() => void 0);
                    await ctx.scene.leave();
                });
            }
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('sell:airport', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database }) {
                const airportCollection = database.am4.collection<AM4.Airport>('Airports');
                const planeCollection = database.am4.collection<AM4.Plane>('Planes');
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    ctx.scene.session.gameMode = (<DataCallbackQuery>ctx.callbackQuery).data as GameMode;
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.reply('Type the ICAO, IATA or id of the airport followed by the plane...\nFormat: `<icao|iata>, <plane>`\nExample: `cdg, a380-800`', {
                        parse_mode: 'Markdown',
                        reply_markup: action_keyboard.reply_markup
                    });
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    ctx.scene.session.input = ctx.message.text;
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('Realism', 'Realism'),
                        Markup.button.callback('Easy', 'Easy'),
                        Markup.button.callback('❌ Exit', 'exit')
                    ]);
                    await ctx.reply('Do you play on realism or easy?', keyboard);
                });
                this.scene.action(/Realism|Easy/, async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.answerCbQuery();
                    await ctx.deleteMessage().catch(() => void 0);
                    const mode = (<DataCallbackQuery>ctx.callbackQuery).data as GameMode;
                    const locale = ctx.from.language_code || 'en';
                    await ctx.scene.leave();
                    try {
                        const [airport_input, plane_input] = ctx.scene.session.input.toLowerCase().split(',').map(s => s.trim());
                        if (!airport_input) throw new TelegramClientError('You need to define the airport...');
                        if (!plane_input) throw new TelegramClientError('You need to define the plane...');
                        const plane = await planeCollection.findOne({ $text: { $search: `"${plane_input}"` } });
                        if (!plane) throw new TelegramClientError(`Could not find a plane with *${plane_input}*...`);
                        const hub = await airportCollection.findOne({
                            $or: [
                                { iata: airport_input.toLowerCase() },
                                { icao: airport_input.toLowerCase() }
                            ]
                        });
                        if (!hub) throw new TelegramClientError('That is not a valid airport...');
                        const airports = await airportCollection.aggregate<GeoNear<AM4.Airport>>([
                            {
                                $geoNear: {
                                    near: { 
                                        type: "Point", 
                                        coordinates: hub.location.coordinates 
                                    },
                                    query: {
                                        market: { $gte: 89 },
                                        runway: { $gte: mode === "Realism" ? plane.runway : 0 }
                                    },
                                    maxDistance: plane.range * 2 * 1000,
                                    minDistance: 100 * 1000,
                                    distanceMultiplier: 0.001,
                                    distanceField: "dist.calculated",
                                    includeLocs: "dist.location",
                                    spherical: true
                                }
                            },
                            {
                                $limit: 1
                            }
                        ]).toArray();
                        if (!airports.length) throw new TelegramClientError('Could not find any airports with that criteria...');
                        const [airport] = airports;
                        const title = `${airport.city.capitalizeWords({ capitalizeAfterQuote: true })}, ${airport.country.capitalizeWords({ capitalizeAfterQuote: true })} (${airport.iata.toUpperCase()}(${airport.icao.toUpperCase()}))`;
                        const content = `Runway: ${airport.runway.toLocaleString(locale)} ft\nMarket: ${airport.market}%\nDistance: ${airport.dist.calculated.toLocaleString(locale)} km`;
                        await ctx.replyWithVenue(airport.location.coordinates[1], airport.location.coordinates[0], title, content);
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
                this.scene.action('exit', async (ctx) => {
                    await ctx.answerCbQuery();
                    await ctx.deleteMessage().catch(() => void 0);
                    await ctx.scene.leave();
                })
            }
        }
    ]
}

export = command;