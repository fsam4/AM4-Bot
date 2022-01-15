import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import Route from '../../../src/classes/route';
import pug from 'pug';

import type { AM4_Data, BaseDocument } from '@typings/database';
import type { Message, User } from 'typegram';
import type { Document } from 'mongodb';
import type { Command } from '../types';

type SeatType = "Y" | "J" | "F" | "L" | "H";

interface RouteDocument extends BaseDocument {
    totalPax: number;
    totalCargo: number;
    distance: number;
    flights: number;
    profit: number;
    preference: any[];
    configuration: Record<SeatType, number>;
    demand: Record<SeatType, number>;
    arrival: AM4_Data.airport;
    ticket: {
        realism: Record<SeatType, number>;
        easy: Record<SeatType, number>;
    };
}

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
    mode: 'realism' | 'easy';
    input: string;
    pages: {
        list: string[],
        current: number,
    };
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const R = 6371 * (Math.pow(10, 3));
const P = (Math.PI / 180);

const command: Command<Scenes.SceneContext, SceneContext> = {
    name: 'routes',
    cooldown: 30,
    description: 'Search for routes from a hub',
    help: "This command can be used to search routes from a specified hub. The bot calculates the profits and configurations for every route and returns them sorted by profitability. The command has 2 required parameters and 2 optional parameters. The required parameters are `<icao|iata>` which is the ICAO or IATA code of the departure airport and `<plane>` which is the name/shortcut of the plane. The optional parameters are `(reputation)` which is the reputation to use in calculations and `(flights)` which can be used to define the flight amount of all returned routes.",
    async execute(ctx) {
        await ctx.scene.enter('routes');
    },
    actions: [],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('routes', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database }) {
                const airportCollection = database.am4.collection<AM4_Data.airport>('Airports');
                const routeCollection = database.am4.collection<AM4_Data.route>('Routes');
                const planes = database.am4.collection<AM4_Data.plane>('Planes');
                this.scene.use((ctx, next) => {
                    ctx.scene.session.user ||= ctx.from;
                    ctx.scene.session.pages ||= {
                        list: [],
                        current: 0
                    };
                    return next();
                });
                this.scene.enter(async (ctx) => {
                    await ctx.replyWithMarkdown('Type the ICAO/IATA of the departure airport followed by the plane. Additionally you can define other options.\nFormat: `<icao|iata>, <plane>, (reputation), (flights)`\nExample: `efhk, a380-800`');
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    ctx.scene.session.input = ctx.message.text;
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('Realism', 'realism'),
                        Markup.button.callback('Easy', 'easy'),
                        Markup.button.callback('❌ Exit', 'delete')
                    ]);
                    await ctx.reply('Do you play on realism or easy?', keyboard);
                });
                this.scene.action(/realism|easy/, async (ctx) => {
                    if (ctx.scene.session.mode) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const mode = ctx.callbackQuery['data'] as 'realism' | 'easy';
                    ctx.scene.session.mode = mode;
                    try {
                        const input: string[] = ctx.scene.session.input.toLowerCase().split(',').map(s => s.trim());
                        if (input.length < 2) throw new TelegramClientError('You need to atleast define the departure airport and the plane...');
                        type args = [string, string, number, number];
                        let [dep, plane_input, rep=99, flights] = input.map((string, i) => i > 1 ? Number(string) : string) as args;
                        if (flights <= 0) throw new TelegramClientError("The amount of flights needs to be more than 0...");
                        if (rep < 10 || rep >= 100) throw new TelegramClientError("The reputation needs to be more than 10 and less than 101...");
                        const plane = await planes.findOne({ $text: { $search: `"${plane_input}"` } });
                        if (!plane) throw new TelegramClientError(`No plane could be found with *${plane_input}*...`);
                        if (mode === "easy") {
                            plane.A_check.price /= 2;
                            plane.speed *= 1.5;
                        }
                        const departure = await airportCollection.findOne({
                            $or: [
                                { icao: dep.toLowerCase() },
                                { iata: dep.toLowerCase() }
                            ]
                        });
                        if (!departure) throw new TelegramClientError(`That is not a valid departure airport...`);
                        const postCalculationMatch: Document[] = [
                            {
                                $gte: ['$distance', 100]
                            },
                            {
                                $lte: ['$distance', plane.range * 2]
                            },
                            {
                                $cond: {
                                    if: { $eq: [ plane.type, 'cargo' ] },
                                    then: {
                                        $gte: [
                                            '$totalCargo',
                                            {
                                                $multiply: [
                                                    plane.capacity * (rep / 100), 
                                                    '$flights'
                                                ] 
                                            }
                                        ]
                                    },
                                    else: {
                                        $gte: [
                                            '$totalPax',
                                            {
                                                $multiply: [
                                                    plane.capacity * (rep / 100), 
                                                    '$flights'
                                                ] 
                                            }
                                        ]
                                    }
                                }
                            }
                        ];
                        if (mode === "realism") {
                            postCalculationMatch.push({
                                $gte: [
                                    '$arrival.runway',
                                    plane.runway
                                ]
                            });
                        }
                        if (flights) {
                            postCalculationMatch.push({
                                $lte: [
                                    18,
                                    {
                                        $floor: {
                                            $multiply: [
                                                flights,
                                                {
                                                    $divide: [
                                                        "$distance",
                                                        plane.speed
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                ]
                            });
                        }
                        const pipeline: Document[] = [
                            {
                                $match: {
                                    airports: departure._id
                                }
                            },
                            {
                                $lookup: {
                                    from: 'Airports',
                                    let: {
                                        arrival: { $arrayElemAt: ["$airports", 0] },
                                        departure: { $arrayElemAt: ["$airports", 1] }
                                    },
                                    pipeline: [
                                        {
                                            $match: { 
                                                $expr: {
                                                    $eq: [ 
                                                        "$id", 
                                                        { 
                                                            $cond: {
                                                                if: { $eq: ['$$departure', departure._id] },
                                                                then: "$$arrival",
                                                                else: "$$departure"
                                                            }
                                                        } 
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    as: 'arrival'
                                }
                            },
                            {
                                $unwind: '$arrival'
                            },
                            {
                                $addFields: {
                                    totalPax: { $add: ['$demand.Y', { $multiply: ['$demand.J', 2] }, { $multiply: ['$demand.F', 3] }] },
                                    totalCargo: { $round: { $add: ['$demand.H', { $multiply: ['$demand.L', 10 / 7] }] } },
                                    distance: {
                                        $round: [
                                            {
                                                $divide: [
                                                    {
                                                        $multiply: [ R, 
                                                            { 
                                                                $acos: { 
                                                                    $add: [
                                                                        { 
                                                                            $multiply: [
                                                                                { $sin: { $multiply: [departure.location.coordinates[1], P] } },
                                                                                { $sin: { $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 1 ] }, P] } }
                                                                            ] 
                                                                        },
                                                                        { 
                                                                            $multiply: [
                                                                                { $cos: { $multiply: [departure.location.coordinates[1], P] } },
                                                                                { $cos: { $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 1 ] }, P] } },
                                                                                { $cos: { $subtract: [{ $multiply: [{ $arrayElemAt: [ "$arrival.location.coordinates", 0 ] }, P] }, { $multiply: [departure.location.coordinates[0], P] }] } }
                                                                            ] 
                                                                        }
                                                                    ] 
                                                                } 
                                                            } 
                                                        ]
                                                    }, 1000
                                                ]
                                            }, 0
                                        ]
                                    },
                                }
                            },
                            {
                                $addFields: {
                                    flights: flights || {
                                        $add: [
                                            {
                                                $floor: { 
                                                    $divide: [
                                                        18, 
                                                        { $divide: ['$distance', plane.speed] }
                                                    ] 
                                                }
                                            }, 1
                                        ]
                                    }
                                }
                            },
                            {
                                $match: {
                                    $expr: {
                                        $and: postCalculationMatch
                                    }
                                }
                            },
                            {
                                $sort: plane.type === "cargo" ? { totalCargo: -1 } : { totalPax: -1 }
                            },
                            {
                                $limit: 100
                            },
                            {
                                $project: {
                                    'arrival.gps': false,
                                    airports: false
                                }
                            }
                        ];
                        let routes = await routeCollection.aggregate<RouteDocument>(pipeline, { allowDiskUse: true }).toArray();
                        if (!routes.length) throw new TelegramClientError('Could not find any suitable routes with your criteria...');
                        const arrivalIds = new Set(routes.map(({ arrival }) => arrival._id));
                        routes = [...arrivalIds].map(arrivalId => routes.find(route => route.arrival._id.equals(arrivalId)));
                        routes.forEach(route => {
                            const { preference, configuration } = Route.configure(plane, {
                                route: {
                                    demand: route.demand, 
                                    distance: route.distance
                                },
                                options: {
                                    flights: route.flights,
                                    mode: mode,
                                    activity: 18,
                                    reputation: rep 
                                }
                            });
                            const profit = Route.profit(plane, {
                                route: {
                                    configuration: configuration,
                                    distance: route.distance,
                                    flights: route.flights  
                                },
                                options: {
                                    fuel_price: 500,
                                    co2_price: 125,
                                    activity: 18,
                                    reputation: rep,
                                    mode: mode
                                }
                            }).profit;
                            route.configuration = configuration;
                            route.preference = preference;
                            route.profit = profit;
                            route.ticket = {
                                realism: Route.ticket(route.distance, 'realism', plane.type === "vip"),
                                easy: Route.ticket(route.distance, 'easy', plane.type === "vip")
                            }
                        });
                        routes.sort((a, b) => b.profit - a.profit);
                        const compile = pug.compileFile('client/telegram/layouts/route.pug');
                        const pages = routes.map(route => {
                            return compile({
                                ...route,
                                departure: departure,
                                config: route.configuration,
                                ticket: route.ticket[mode],
                                plane: plane,
                                route: route
                            });
                        });
                        const markup = Markup.inlineKeyboard([
                            Markup.button.callback('▶️', 'next'),
                            Markup.button.callback('🗑️', 'delete')
                        ]);
                        const msg = await ctx.editMessageText(pages[0], {
                            reply_markup: pages.length > 1 ? markup.reply_markup: undefined,
                            parse_mode: 'HTML'
                        });
                        if (pages.length === 1) await ctx.scene.leave();
                        ctx.scene.session.message = <Message.TextMessage>msg;
                        ctx.scene.session.pages.list.push(...pages);
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
                    const option: string = ctx.callbackQuery['data'];
                    const current_page = ctx.scene.session.pages.current;
                    const max_page = ctx.scene.session.pages.list.length - 1;
                    if (current_page === 0 && option === 'prev') return;
                    if (current_page === max_page && option === 'next') return;
                    if (option === 'next') ctx.scene.session.pages.current++;
                    if (option === 'prev') ctx.scene.session.pages.current--;
                    await ctx.answerCbQuery(`Page ${ctx.scene.session.pages.current + 1} of ${ctx.scene.session.pages.list.length}`);
                    const buttons = [Markup.button.callback('🗑️', 'delete')];
                    if (ctx.scene.session.pages.current < max_page) buttons.unshift(Markup.button.callback('▶️', 'next'));
                    if (ctx.scene.session.pages.current > 0) buttons.unshift(Markup.button.callback('◀️', 'prev'));
                    const markup = Markup.inlineKeyboard(buttons);
                    await ctx.editMessageText(ctx.scene.session.pages.list[ctx.scene.session.pages.current], { 
                        parse_mode: 'HTML', 
                        reply_markup: markup.reply_markup
                    }).catch(err => void err);
                });
                this.scene.action('delete', async (ctx) => {
                    await ctx.deleteMessage().catch(err => void err);
                    await ctx.scene.leave();
                });
            }
        }
    ]
}

export = command;