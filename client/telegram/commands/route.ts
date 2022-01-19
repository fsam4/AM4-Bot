import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import Route from '../../../src/classes/route';
import pug from 'pug';

import type { Message, User } from 'typegram';
import type { AM4_Data } from '@typings/database';
import type { Command } from '../types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
    mode: 'realism' | 'easy';
    input: string;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const command: Command<Scenes.SceneContext, never, SceneContext> = {
    name: 'route',
    cooldown: 25,
    description: "Search for a route and it's stopover, config, ticket prices...",
    help: "This command can be used to search for a route and it's ticket prices, stopover, configuration, demand, etc. The command has two required parameters and three optional parameters. The required parameters are `<icao|iata>, <icao|iata>` which are the ICAO or IATA codes of the departure and arrival airports. The three optional parameters are `(plane)` which can be used to define the plane to use on this route, `(reputation)` which can be used to define the reputation used in the calculations and `(flights)` which can be used to define the flights per day of the route. If flights is not defined it will calculate it.",
    async execute(ctx) {
        await ctx.scene.enter('route');
    },
    actions: [],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('route', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const planes = database.am4.collection<AM4_Data.plane>('Planes');
                const airports = database.am4.collection<AM4_Data.airport>('Airports');
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
                    const mode = ctx.callbackQuery['data'];
                    const locale = ctx.from.language_code || 'en';
                    ctx.scene.session.mode = ctx.callbackQuery['data'];
                    try {
                        const input: string[] = ctx.scene.session.input.toLowerCase().split(',').map(s => s.trim());
                        await ctx.scene.leave();
                        if (input.length < 2) throw new TelegramClientError('You need to define both departure and arrival airports!');
                        type args = [string, string, string, number, number];
                        let [dep, arr, plane_input, rep=99, flights] = input.map((string, i) => i > 2 ? Number(string) : string) as args;
                        const departure = await airports.findOne({
                            $or: [
                                { icao: dep.toLowerCase() },
                                { iata: dep.toLowerCase() }
                            ]
                        });
                        if (!departure) throw new TelegramClientError('That is not a valid departure airport...');
                        const arrival = await airports.findOne({
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
                        let options: object = { departure, arrival, route, ticket: ticket[mode].default, demand, locale };
                        if (plane_input) {
                            const plane = await planes.findOne({ $text: { $search: `"${plane_input}"` } });
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
                            options = { ...options, config: configuration, flights, plane };
                            if (route.distance > plane.range) {
                                if (plane.type === "vip") throw new TelegramClientError("Currently it is not possible to fetch a stopover for a VIP plane...");
                                const { stopover, status } = await rest.fetchStopover({
                                    type: plane.type,
                                    departure: dep,
                                    arrival: arr,
                                    model: plane.name
                                });
                                if (!status.success) throw new TelegramClientError(status.error.replace('long route for this aircraft', 'No suitable stopover could be found for this route...'));
                                if (typeof stopover[mode] === 'string') throw new TelegramClientError(stopover[mode]);
                                options = { ...options, stopover: stopover[mode] };
                            }
                        }
                        const reply = compile(options);
                        await ctx.editMessageText(reply, {
                            parse_mode: 'HTML'
                        });
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
                    await ctx.deleteMessage().catch(() => undefined);
                    await ctx.scene.leave();
                });
            }
        }
    ]
}

export = command;