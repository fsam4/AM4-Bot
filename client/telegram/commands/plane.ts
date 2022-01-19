import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import QuickChart from 'quickchart-js';
import addMonths from 'date-fns/addMonths';
import Plane from '../../../src/lib/plane';
import pug from 'pug';

import type { Message, User, InlineKeyboardMarkup, InputMediaPhoto } from 'typegram';
import type { Telegram, AM4_Data } from '@typings/database';
import type { Context } from 'telegraf';
import type { Command } from '../types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    gameMode: "realism" | "easy";
    user: User;
    data: {
        engines: Map<string, string>,
        image: Buffer,
        input: string,
        markup: InlineKeyboardMarkup
    }
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>

const data = (ctx: SceneContext, next: () => void) => {
    ctx.scene.session.user ||= ctx.from;
    ctx.scene.session.data ||= {
        engines: new Map(),
        image: undefined,
        input: undefined,
        markup: undefined
    }
    return next()
}

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: 'plane',
    cooldown: 20,
    description: 'Search or compare planes',
    help: 'This command can be used to search planes or compare planes. When searching planes the only required parameter is the plane name or shortcut. For a list of shortcuts use this command and choose shortcuts. When comparing planes you need to define 2-5 planes seperated by a comma.',
    async execute(ctx, { timeouts }) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🔍 Search', 'search:plane'),
            Markup.button.callback('📊 Compare', 'compare:plane'),
            Markup.button.callback('❌ Exit', 'exit')
        ]);
        const reply_text = [
            "🔍: Search for a certain plane",
            "📊: Compare planes with charts"
        ];
        await ctx.replyWithMarkdown(reply_text.join('\n'), keyboard)
        .then(message => {
            const timeout = setTimeout(async () => {
                timeouts.delete(message.message_id);
                await ctx.telegram.deleteMessage(message.chat.id, message.message_id)
                .catch(() => undefined);
            }, 120000);
            timeouts.set(message.message_id, timeout);
        });
    },
    actions: [
        {
            value: /(search|compare)(?=:plane)/,
            async execute(ctx, { timeouts }) {
                if (timeouts.has(ctx.message.message_id)) {
                    const timeout = timeouts.get(ctx.message.message_id);
                    clearTimeout(timeout);
                    timeouts.delete(ctx.message.message_id);
                }
                const option: string = ctx.callbackQuery['data'];
                await ctx.scene.enter(option)
            }
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('search:plane', <BaseSceneOptions>{ ttl: 600000 }),
            async register({ database }) {
                const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
                const keyboards = database.telegram.collection<Telegram.keyboard>('Keyboards');
                this.scene.use(data);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: 'plane' });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Type the plane shortcut or name...\nFormat: `<plane>`\nExample: `cessna 172`'];
                    if (keyboard) {
                        const columns = keyboard.input.length > 1 ? Math.trunc(keyboard.input.length / 2) : 1;
                        const markup = Markup.keyboard(keyboard.input, { columns }).oneTime(true);
                        content.push(markup);
                    }
                    await ctx.replyWithMarkdown(...content);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.data.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const locale = ctx.from.language_code || 'en';
                    ctx.scene.session.data.input = ctx.message.text;
                    try {
                        const plane = await planeCollection.findOne({ $text: { $search: `"${ctx.message.text}"` } });
                        if (!plane) throw new TelegramClientError(`No plane could be found with *${ctx.message.text}*...`);
                        const compile = pug.compileFile('client/telegram/layouts/plane.pug');
                        const default_reply = compile({ 
                            plane, locale,
                            easy: Plane.profit(plane, { mode: 'easy' }),
                            realism: Plane.profit(plane, { mode: 'realism' })
                        });
                        for (const engine of plane.engines) {
                            plane.fuel = engine.fuel;
                            plane.speed = engine.speed;
                            const reply = compile({ 
                                plane, locale,
                                easy: Plane.profit(plane, { mode: 'easy' }),
                                realism: Plane.profit(plane, { mode: 'realism' })
                            });
                            ctx.scene.session.data.engines.set(engine.name, reply);
                        }
                        const buttons = plane.engines.map(engine => Markup.button.callback(engine.name, `engine:${engine.name}`));
                        buttons.push(Markup.button.callback('🗑️', 'delete'));
                        const keyboard = Markup.inlineKeyboard(buttons, {
                            columns: Math.ceil(plane.engines.length / 2) + 1
                        });
                        ctx.scene.session.data.markup = keyboard.reply_markup;
                        ctx.scene.session.data.image = plane.image.buffer;
                        await ctx.replyWithPhoto({ source: plane.image.buffer }, {
                            caption: default_reply,
                            parse_mode: 'HTML',
                            reply_markup: keyboard.reply_markup
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
                    finally {
                        await keyboards.bulkWrite([
                            {
                                updateOne: {
                                    filter: { id: ctx.from.id, command: 'plane' },
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
                                    filter: { id: ctx.from.id, command: 'plane' },
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
                this.scene.action(/engine:/, async (ctx) => {
                    const data = ctx.scene.session.data;
                    const expr = new RegExp([...data.engines.keys()].join('|'));
                    const [engineName] = (<string>ctx.callbackQuery['data']).match(expr);
                    const reply = data.engines.get(engineName);
                    if (!reply) return;
                    await ctx.editMessageCaption(reply, {
                        parse_mode: 'HTML',
                        reply_markup: data.markup
                    }).catch(() => ctx.scene.leave());
                });
                this.scene.action('delete', async (ctx) => {
                    ctx.scene.session.data.engines.clear();
                    await ctx.scene.leave();
                });
            }
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('compare:plane', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database }) {
                const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
                this.scene.use(data);
                this.scene.enter(async ctx => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback("Realism", "realism"),
                        Markup.button.callback("Easy", "easy"),
                        Markup.button.callback('❌ Exit', 'exit')
                    ]);
                    await ctx.replyWithMarkdown("Choose the game mode to calculate the statistics by...", keyboard);
                });
                this.scene.action(/realism|easy/, async ctx => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    ctx.scene.session.gameMode = ctx.callbackQuery["data"];
                    const keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.replyWithMarkdown('Type the plane names or shortcuts of the planes that you want to compare...\nFormat: `<plane>,...`\nExample: `a380-800, cessna 172, an-225`', keyboard);
                });
                this.scene.on('text', async ctx => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const messageContent = ctx.message.text.split(',').map(s => s.trim());
                        if (messageContent.length < 2 || messageContent.length > 5) throw new TelegramClientError('You need to provide 2-5 planes only...');
                        const planes = await planeCollection.find({
                            $expr: {
                                $or: messageContent.map(name => ({ $eq: [{ $toLower: '$name' }, name.toLowerCase()] }))
                            }
                        }).toArray();
                        if (!planes) throw new TelegramClientError('Something went wrong with filtering the planes...');
                        if (planes.length < 2) throw new TelegramClientError('You need to provide 2-5 valid planes...');
                        const values: number[] = [];
                        const graphs = [
                            {
                                emoji: "1️⃣",
                                description: "Bar graph comparing the profit, expenses and income of the planes. The gray poles are error bars that display the error margin of the profit depending on which engine you use.",
                                data: {
                                    type: 'bar',
                                    data: {
                                        labels: [
                                            "Profit",
                                            "Expenses",
                                            "Income"
                                        ],
                                        datasets: planes.map(plane => {
                                            const options = { mode: ctx.scene.session.gameMode };
                                            const engines = plane.engines.map(engine => {
                                                const res = Plane.profit({
                                                    ...plane,
                                                    fuel: engine.fuel,
                                                    speed: engine.speed
                                                }, options);
                                                for (const prop in res) values.push(res[prop]);
                                                return res;
                                            });
                                            const res = Plane.profit(plane, options);
                                            engines.push(res);
                                            for (const prop in res) values.push(res[prop]);
                                            return {
                                                label: plane.name,
                                                borderWidth: 1,
                                                data: [
                                                    res.profit, 
                                                    res.expenses, 
                                                    res.income
                                                ],
                                                errorBars: {
                                                    "Profit": {
                                                        plus: Math.max(...engines.map(res => res.profit)) - res.profit,
                                                        minus: res.profit - Math.min(...engines.map(res => res.profit))
                                                    },
                                                    "Expenses": {
                                                        plus: Math.max(...engines.map(res => res.expenses)) - res.expenses,
                                                        minus: res.expenses - Math.min(...engines.map(res => res.expenses))
                                                    },
                                                    "Income": {
                                                        plus: Math.max(...engines.map(res => res.income)) - res.income,
                                                        minus: res.income - Math.min(...engines.map(res => res.income))
                                                    }
                                                }
                                            }
                                        })
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: 'Plane Profitability',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        plugins: {
                                            tickFormat: {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 0
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            },
                                            chartJsPluginErrorBars: {
                                                color: "#aaa",
                                            }
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                display: true,
                                                position: 'right',
                                                align: 'start'
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    beginAtZero: true,
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        padding: 5,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        suggestedMin: Math.min(...values),
                                                        suggestedMax: Math.max(...values)
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    type: 'category',
                                                    gridLines: {
                                                        display: false
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: "2️⃣",
                                description: "Radar graph comparing the staff requirements of the planes. The wider the covered area is the more the plane needs staff overall.",
                                data: {
                                    type: "radar",
                                    data: {
                                        labels: [
                                            'Pilots',
                                            'Crew',
                                            'Engineers',
                                            'Tech'
                                        ],
                                        datasets: planes.map(({ staff, name }) => ({
                                            label: name,
                                            data: [
                                                staff.pilots,
                                                staff.crew,
                                                staff.engineers,
                                                staff.tech
                                            ]
                                        }))
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: 'Plane Staff',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white'
                                            }
                                        },
                                        maintainAspectRatio: true,
                                        spanGaps: false,
                                        elements: {
                                            line: {
                                                tension: 0.000001
                                            }
                                        },
                                        plugins: {
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            },
                                            filler: {
                                                propagate: false
                                            },
                                            "samples-filler-analyser": {
                                                target: "chart-analyser"
                                            }
                                        },
                                        scale: {
                                            pointLabels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white'
                                            },
                                            gridLines: {
                                                drawBorder: true,
                                                color: 'gray'
                                            },
                                            angleLines: {
                                                color: 'gray'
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                emoji: "3️⃣",
                                description: "Scatter graph comparing the A-check requirements of the planes. The y-axe displays the hours until every A-check and the x-axe displays the A-check price.",
                                data: {
                                    type: 'scatter',
                                    data: {
                                        datasets: planes.map(({ A_check, name }) => ({
                                            label: name,
                                            data: [
                                                {
                                                    x: ctx.scene.session.gameMode === 'easy' ? A_check.price / 2 : A_check.price,
                                                    y: A_check.time
                                                }
                                            ]
                                        }))
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'unit',
                                                unit: 'hour'
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'A-check time & price',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                fontSize: 13,
                                                usePointStyle: true
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Hours',
                                                        fontColor: "#191",
                                                        fontFamily: "Mono",
                                                        fontSize: 20,
                                                        fontStyle: "bold",
                                                        padding: {
                                                            top: 20,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0
                                                        }
                                                    },
                                                    ticks: {
                                                        precision: 0,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white'
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Price',
                                                        fontColor: "#191",
                                                        fontFamily: "Mono",
                                                        fontSize: 20,
                                                        fontStyle: "bold",
                                                        padding: {
                                                            top: 20,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0
                                                        }
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        callback: (val: number) => `$${val.toLocaleString('en')}`
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: "4️⃣",
                                description: "Horizontal bar graph comparing the fuel usages of the planes. The graph displays every engine of each plane and their fuel usages as bar heigths.",
                                data: {
                                    type: 'horizontalBar',
                                    data: {
                                        labels: planes.map(plane => plane.name),
                                        datasets: planes.flatMap(plane => plane.engines.map(engine => ({
                                            label: engine.name,
                                            borderWidth: 1,
                                            data: [
                                                {
                                                    x: engine.fuel,
                                                    y: plane.name
                                                }
                                            ]                       
                                        })))
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: 'Fuel Usage',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        plugins: {
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                display: true
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    type: 'category',
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        padding: 5,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white'
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        callback: (val: number) => `${val} lbs/km`
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: "5️⃣",
                                description: "Scatter graph comparing the speed and range of the planes. The y-axe displays the speed and the x-axe displays the range.",
                                data: {
                                    type: 'scatter',
                                    data: {
                                        datasets: planes.map(plane => ({
                                            label: plane.name,
                                            data: [
                                                {
                                                    x: plane.range,
                                                    y: ctx.scene.session.gameMode === 'easy' ? plane.speed * 1.5 : plane.speed,
                                                }
                                            ]
                                        }))
                                    },
                                    options: {
                                        plugins: {
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        elements: {
                                            point: {
                                                pointStyle: "star"
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Speed to range',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                fontSize: 13,
                                                usePointStyle: true
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Speed',
                                                        fontColor: "#191",
                                                        fontFamily: "Mono",
                                                        fontSize: 20,
                                                        fontStyle: "bold",
                                                        padding: {
                                                            top: 20,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0
                                                        }
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        callback: (val: number) => `${val.toLocaleString('en')} km/h`
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Range',
                                                        fontColor: "#191",
                                                        fontFamily: "Mono",
                                                        fontSize: 20,
                                                        fontStyle: "bold",
                                                        padding: {
                                                            top: 20,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0
                                                        }
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        callback: (val: number) => `${val.toLocaleString('en')} km`
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        ];
                        const media = await Promise.all<InputMediaPhoto>(
                            graphs.map(async graph => {
                                const chart = new QuickChart();
                                chart.setConfig(graph.data);
                                chart.setBackgroundColor('black');
                                return {
                                    type: "photo",
                                    media: await chart.getShortUrl(),
                                    caption: graph.description
                                }
                            })
                        );
                        
                        await ctx.replyWithMediaGroup(media);
                    }
                    catch(error) {
                        if (error instanceof TelegramClientError) {
                            await error.send(ctx);
                        } else {
                            console.error(error);
                            await TelegramClientError.sendUnknownError(ctx);
                        }
                    }
                })
            }
        }
    ]
}

export = command;