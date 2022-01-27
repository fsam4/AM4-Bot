import { MongoDB as Utils } from '../../utils';
import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import Route from '../../../src/classes/route';
import pug from 'pug';
import fs from 'fs';

import type { Command, DataCallbackQuery } from '@telegram/types';
import type { Message, User } from 'typegram';
import type { AM4_Data } from '@typings/database';

type GameMode = "realism" | "easy";

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
    mode: GameMode;
    input: string;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const { createLocationSphere } = Utils;

const command: Command<Scenes.SceneContext, never, SceneContext> = {
    name: 'route',
    cooldown: 25,
    description: "Search for a route and it's stopover, config, ticket prices...",
    helpFileContent: fs.readFileSync("./documents/markdown/route.md", "utf8"),
    async execute(ctx) {
        await ctx.scene.enter('route');
    },
    actions: [],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('route', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
                const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
                this.scene.use((ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    return next();
                });
                this.scene.enter(async (ctx) => {
                    await ctx.replyWithMarkdown('Type the ICAO/IATA of the departure & arrival airport seperated by a comma. Additionally you can give the plane and other options for this route to calculate configuration, stopover, etc...\nFormat: `<icao|iata>, <icao|iata>, (plane), (reputation), (flights)`\nExample: `efhk, omaa`');
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    ctx.scene.session.input = ctx.message.text;
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('Realism', 'realism'),
                        Markup.button.callback('Easy', 'easy'),
                        Markup.button.callback('❌ Exit', 'exit')
                    ]);
                    await ctx.reply('Do you play on realism or easy?', keyboard);
                });
                this.scene.action(/realism|easy/, async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const mode = (<DataCallbackQuery>ctx.callbackQuery).data as GameMode;
                    const locale = ctx.from.language_code || 'en';
                    ctx.scene.session.mode = mode;
                    try {
                        const input: string[] = ctx.scene.session.input.toLowerCase().split(',').map(s => s.trim());
                        await ctx.scene.leave();
                        if (input.length < 2) throw new TelegramClientError('You need to define both departure and arrival airports!');
                        type args = [string, string, string, number, number];
                        let [dep, arr, plane_input, rep=99, flights] = input.map((string, i) => i > 2 ? Number(string) : string) as args;
                        const departure = await airportCollection.findOne({
                            $or: [
                                { icao: dep.toLowerCase() },
                                { iata: dep.toLowerCase() }
                            ]
                        });
                        if (!departure) throw new TelegramClientError('That is not a valid departure airport...');
                        const arrival = await airportCollection.findOne({
                            $or: [
                                { icao: arr.toLowerCase() },
                                { iata: arr.toLowerCase() }
                            ]
                        });
                        if (!arrival) throw new TelegramClientError('That is not a valid arrival airport...');
                        const { status, route, ticket, demand } = await rest.fetchRoute('demand', {
                            dep_icao: departure.icao,
                            arr_icao: arrival.icao
                        });
                        if (!status.success) throw new TelegramClientError(status.error);
                        const compile = pug.compileFile('client/telegram/layouts/route.pug');
                        let options: { [key: string]: any } = { 
                            departure, arrival, demand, locale,
                            distance: route.distance, 
                            ticket: ticket[mode].default 
                        };
                        if (plane_input) {
                            const plane = await planeCollection.findOne({ $text: { $search: `"${plane_input}"` } });
                            if (!plane) throw new TelegramClientError(`No plane was found with *${plane_input}*...`);
                            if (mode === "easy") {
                                plane.A_check.price /= 2;
                                plane.speed *= 1.5;
                            }
                            if (!flights) flights = Route.flights(route.distance, plane.speed, 18);
                            const { configuration } = Route.configure(plane, {
                                route: {
                                    demand: demand, 
                                    distance: route.distance
                                },
                                options: {
                                    flights: flights,
                                    mode: mode,
                                    activity: 18,
                                    reputation: rep 
                                }
                            });
                            options = { ...options, configuration, flights, plane };
                            if (route.distance > plane.range) {
                                const airports = await airportCollection.find({
                                    location: {
                                        $geoWithin: {
                                            $centerSphere: createLocationSphere(
                                                departure.location.coordinates, 
                                                arrival.location.coordinates
                                            )
                                        }
                                    }
                                }).toArray();
                                const stopovers = Route.findStopovers([departure, arrival], airports, plane, mode);
                                if (!stopovers.length) throw new TelegramClientError("No suitable stopover could be found for this route...");
                                const [stopover] = stopovers;
                                const lastIndex = stopovers.length - 1;
                                const [stopoverAirport] = stopover.airports.slice(1, lastIndex);
                                options = { ...options, stopover: stopoverAirport };
                            }
                        }
                        await ctx.answerCbQuery();
                        const reply = compile(options);
                        await ctx.editMessageText(reply, { parse_mode: 'HTML' });
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
        }
    ]
}

export = command;