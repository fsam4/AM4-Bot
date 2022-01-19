import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import QuickChart from 'quickchart-js';
import Airline from '../../../src/classes/airline';
import Plane from '../../../src/lib/plane';
import pug from 'pug';

import addMonths from 'date-fns/addMonths';
import subHours from 'date-fns/subHours';
import format from 'date-fns/format';

import type { Message, User, InputMediaPhoto } from 'typegram';
import type { Telegram, AM4_Data } from '@typings/database';
import type { Context } from 'telegraf';
import type { Command } from '../types';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;
type Aircraft = AM4_Data.plane & { amount?: number };

const data = (ctx: SceneContext, next: () => void) => {
    ctx.scene.session.user ||= ctx.from;
    return next()
}

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: 'airline',
    cooldown: 10,
    description: 'Search or compare airlines',
    help: "With this command you can search or compare airlines. When searcing for an airline there is one required argument which is `<name|id>`. This mean you need to either type the name or the ID of that airline. If you cannot find the right airline by username then try ID as that gives more accurate results. When comparing airlines you need to type 2-5 airlines seperated by commas. So for example if you want to compare Prestige Wings and AMBE Airlines use `prestige wings, ambe airlines`.",
    async execute(ctx, { timeouts }) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🔍 Search', 'search:airline'),
            Markup.button.callback('📊 Compare', 'compare:airline'),
            Markup.button.callback('❌ Exit', 'exit')
        ]);
        const reply_text = [
            "🔍: Search for a specific airline",
            "📊: Compare airlines with charts"
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
            value: /(search|compare)(?=:airline)/,
            async execute(ctx, { timeouts }) {
                if (timeouts.has(ctx.message.message_id)) {
                    const timeout = timeouts.get(ctx.message.message_id);
                    clearTimeout(timeout);
                    timeouts.delete(ctx.message.message_id);
                }
                const option: string = ctx.callbackQuery['data'];
                await ctx.scene.enter(option);
            }
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('search:airline', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const keyboards = database.telegram.collection<Omit<Telegram.keyboard, '_id'>>('Keyboards');
                const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
                this.scene.use(data);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: 'airline' });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Type the name or the ID of the airline...\nFormat: `<name|id>`\nExample: `prestige wings`'];
                    if (keyboard) {
                        const columns = keyboard.input.length > 1 ? Math.trunc(keyboard.input.length / 2) : 1;
                        const markup = Markup.keyboard(keyboard.input, { columns }).oneTime(true);
                        content.push(markup);
                    }
                    await ctx.replyWithMarkdown(...content);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    const locale = ctx.from.language_code || 'en';
                    await ctx.scene.leave();
                    try {
                        const input = Number(ctx.message.text) || ctx.message.text;
                        const { status, airline, fleet, ipo, awards } = await rest.fetchAirline(input);
                        if (!status.success) throw new TelegramClientError(status.error);
                        const planes = await planeCollection.aggregate<Aircraft>([
                            {
                                $match: { 
                                    name: { 
                                        $in: fleet.planes.map(plane => plane.name) 
                                    } 
                                }
                            },
                            {
                                $addFields: {
                                    amount: {
                                        $let: {
                                            vars: {
                                                fleet: fleet.planes
                                            },
                                            in: {
                                                $first: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: "$$fleet",
                                                                as: "plane",
                                                                cond: { $eq: ["$$plane.name", "$name"] }
                                                            }
                                                        },
                                                        as: "plane",
                                                        in: "$$plane.amount"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]).toArray();
                        type GameMode = Lowercase<typeof airline.gameMode>;
                        const compile = pug.compileFile('client/telegram/layouts/airline.pug');
                        const profit = Airline.profit(planes, { 
                            mode: <GameMode>airline.gameMode.toLowerCase(),
                            reputation: airline.reputation
                        });
                        const cargoFleet = planes.filter(plane => plane.type === 'cargo');
                        const paxFleet = planes.filter(plane => plane.type === 'pax');
                        const reply = compile({ 
                            airline, fleet, ipo, awards, format, subHours, locale,
                            paxFleetSize: paxFleet.length && cargoFleet.map(plane => plane.amount).reduce((a, b) => a + b),
                            cargoFleetSize: cargoFleet.length && cargoFleet.map(plane => plane.amount).reduce((a, b) => a + b),
                            staff: Airline.calculateStaff(planes),
                            profit: profit.airline.profit
                        });
                        const buttons = [];
                        if (airline.logo) buttons.push(Markup.button.url('Logo', airline.logo));
                        if (ipo.has) {
                            const sv = ipo.growth.reverse()
                            const history = new QuickChart()                     
                            .setConfig({
                                type: 'line',
                                data: {
                                    datasets: [
                                        {
                                            label: 'Share Value',
                                            backgroundColor: 'rgb(0, 255, 0, 1)',
                                            borderColor: 'rgb(0, 255, 0, 1)',
                                            fill: false,
                                            data: sv.map(share => ({
                                                x: share.date,
                                                y: share.value
                                            }))
                                        }
                                    ],
                                },
                                options: {
                                    plugins: {
                                        tickFormat: {
                                            style: 'currency',
                                            currency: 'USD',
                                            minimumFractionDigits: 0
                                        }
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
                                                type: 'linear',
                                                gridLines: {
                                                    drawBorder: true,
                                                    color: 'gray'
                                                },
                                                ticks: {
                                                    padding: 5,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    fontSize: 13,
                                                    maxTicksLimit: 10
                                                }
                                            }
                                        ],
                                        xAxes: [
                                            {
                                                type: 'time',
                                                gridLines: {
                                                    display: false
                                                },
                                                time: {
                                                    isoWeekday: true,
                                                    parser: "MM/DD/YYYY HH:mm",
                                                    displayFormats: {
                                                        day: "MM/DD - HH:mm",
                                                        hour: "HH:mm"
                                                    }
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    fontSize: 13,
                                                    major: {
                                                        enabled: true
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }).setBackgroundColor('black');
                            const url = await history.getShortUrl();
                            buttons.push(Markup.button.url('Share Growth Chart', url));
                        }
                        if (fleet.size) {
                            const chart = new QuickChart()
                            .setConfig({
                                type: 'pie',
                                data: {
                                    datasets: [
                                        {
                                            data: planes.map(plane => Plane.profit(plane, { mode: airline.gameMode.toLowerCase() as Lowercase<typeof airline.gameMode> }).profit * plane.amount)
                                        }
                                    ],
                                    labels: planes.map(plane => `${plane.name} • ${plane.amount}x`),
                                },
                                options: {
                                    legend: {
                                        position: 'right',
                                        align: 'start',
                                        labels: {
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                            usePointStyle: true
                                        }
                                    },
                                    plugins: {
                                        colorschemes: {
                                            scheme: 'tableau.Classic20'
                                        },
                                        datalabels: {
                                            display: planes.length < 8,
                                            align: 'center',
                                            backgroundColor: 'white',
                                            borderColor: "black",
                                            borderWidth: 1,
                                            borderRadius: 3,
                                            font: {
                                                color: 'black'
                                            },
                                            formatter: (value: number) => {
                                                let s = value < 1000000000 ? (value / 1000000).toFixed(1) + 'm' : (value / 1000000000).toFixed(1) + 'b'
                                                return '$' + s;
                                            }
                                        },
                                    },
                                    title: {
                                        display: true,
                                        position: 'left',
                                        text: 'Fleet profit per plane type',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
                                    },
                                },
                            })
                            .setBackgroundColor('black');
                            const url = await chart.getShortUrl();
                            buttons.push(Markup.button.url('Fleet Profitability', url));
                        }
                        const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });
                        await ctx.replyWithHTML(reply, keyboard);
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
                                    filter: { id: ctx.from.id, command: 'airline' },
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
                                    filter: { id: ctx.from.id, command: 'airline' },
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
                this.scene.action('exit', async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    await ctx.scene.leave();
                });
            }
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('compare:airline', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const aircrafts = database.am4.collection<AM4_Data.plane>('Planes');
                this.scene.use(data);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.replyWithMarkdown('Type the names or IDs of the airlines seperated by commas...\nFormat: `<name|id>,...`\nExample: `prestige wings, ambe airlines, world express airlines`', action_keyboard)
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const airline_input = ctx.message.text.split(', ').map(s => s.trim());
                        if (airline_input.length < 2 || airline_input.length > 5) throw new TelegramClientError('You need to provide 2-5 airlines to compare...');
                        const planes = await aircrafts.find().toArray();
                        const airlines = await Promise.all<Airline>(
                            airline_input.map(async input => {
                                const response = await rest.fetchAirline(Number(input) || input);
                                if (!response.status.success) throw new TelegramClientError(`*${input}:* ${response.status.error}`)
                                response.fleet.planes = planes.filter(plane => response.fleet.planes.some(({ name }) => name === plane.name)).map(plane => {
                                    const amount = response.fleet.planes.find(({ name }) => name === plane.name).amount;
                                    return { ...plane, amount }
                                });
                                return response;
                            })
                        );
                        type GameMode = "realism" | "easy";
                        const graphs = [
                            {
                                emoji: '1️⃣',
                                description: 'Scatter graph comparing airline profit to fleet size. The y-axis represents fleet size and the x-axis represents profit. Profit is calculated with default settings to make the comparison and differences more accurate and visible. Due to large numbers x-axis is given in logarithmic values.',
                                data: {
                                    type: 'scatter',
                                    data: {
                                        datasets: airlines.map(({ airline, fleet }) => ({
                                            label: airline.name,
                                            data: [
                                                {
                                                    x: Airline.profit(<Aircraft[]>fleet.planes, { 
                                                        mode: <GameMode>airline.gameMode.toLowerCase(),
                                                        reputation: {
                                                            pax: 100,
                                                            cargo: 100
                                                        }
                                                    }).airline.profit,
                                                    y: fleet.size,
                                                }
                                            ]
                                        })),
                                    },
                                    options: {
                                        plugins: {
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Airline profit to fleet size',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white'
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    display: true,
                                                    type: 'linear',
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Fleet size',
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
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        padding: 5,
                                                        maxTicksLimit: 16,
                                                        stepSize: 1,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white'
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    display: true,
                                                    type: 'logarithmic',
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Profit',
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
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white'
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '2️⃣',
                                description: 'Radar graph comparing general airline statistics.',
                                data: {
                                    type: "radar",
                                    data: {
                                        labels: [
                                            'Achievements',
                                            'Cargo fleet',
                                            'Pax fleet',
                                            'Level',
                                            'Pax Reputation',
                                            'Cargo Reputation'
                                        ],
                                        datasets: airlines.map(({ airline, fleet }) => {
                                            const paxPlanes = (<Aircraft[]>fleet.planes).filter(plane => plane.type === 'pax');
                                            const cargoPlanes = (<Aircraft[]>fleet.planes).filter(plane => plane.type === 'cargo');
                                            return {
                                                label: airline.name,
                                                data: [
                                                    airline.achievements,
                                                    cargoPlanes.length && cargoPlanes.map(plane => plane.amount).reduce((a, b) => a + b),
                                                    paxPlanes.length && paxPlanes.map(plane => plane.amount).reduce((a, b) => a + b),
                                                    airline.level,
                                                    airline.reputation.pax,
                                                    airline.reputation.cargo
                                                ]
                                            }
                                        })
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: 'General Statistics',
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
                                emoji: '3️⃣',
                                description: 'Line graph comparing share value growth.',
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: airlines.map(({ ipo, airline }) => ({
                                            fill: false,
                                            label: airline.name,
                                            data: ipo.growth.map((share) => ({
                                                x: share.date,
                                                y: share.value
                                            }))
                                        }))
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 2
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Share Value Growth',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white'
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
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
                                                    type: 'time',
                                                    time: {
                                                        isoWeekday: true,
                                                        parser: "MM/DD/YYYY HH:mm",
                                                        displayFormats: {
                                                            day: "MM/DD - HH:mm",
                                                            hour: "HH:mm"
                                                        }
                                                    },
                                                    gridLines: {
                                                        display: false
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        maxTicksLimit: 20,
                                                        major: {
                                                            enabled: true
                                                        }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '4️⃣',
                                description: 'Stacked bar graph comparing airline income and expenses. The total height of the bar displays the total income of the airline. The red area inside the bar represents the expenses and the green area represents profit.',
                                data: {
                                    type: 'bar',
                                    data: {
                                        labels: airlines.map(({ airline }) => airline.name),
                                        datasets: [
                                            {
                                                label: 'Income',
                                                backgroundColor: 'rgb(11, 245, 97)',
                                                data: airlines.map(({ fleet, airline }) => {
                                                    return Airline.profit(<Aircraft[]>fleet.planes, { 
                                                        mode: <GameMode>airline.gameMode.toLowerCase(),
                                                        reputation: {
                                                            pax: 100,
                                                            cargo: 100
                                                        }
                                                    }).airline.profit;
                                                })
                                            },
                                            {
                                                label: 'Expenses',
                                                backgroundColor: 'rgb(245, 11, 11)',
                                                data: airlines.map(({ fleet, airline }) => {
                                                    return Airline.profit(<Aircraft[]>fleet.planes, { 
                                                        mode: <GameMode>airline.gameMode.toLowerCase(),
                                                        reputation: {
                                                            pax: 100,
                                                            cargo: 100
                                                        }
                                                    }).airline.expenses;
                                                })
                                            }
                                        ],
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 0
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Airline Profitability',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    stacked: true,
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
                                                    stacked: true,
                                                    gridLines: {
                                                        display: false
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                    }
                                                }
                                            ]
                                        },
                                    },
                                }
                            },
                            {
                                emoji: '5️⃣',
                                description: '',
                                data: {
                                    type: "line",
                                    data: {
                                        labels: [
                                            "Pax Airline",
                                            "Cargo Airline",
                                            "Alliance Contributor",
                                            "Best CEO",
                                            "Best A/C Service",
                                            "Most Profitable"
                                        ],
                                        datasets: airlines.map(({ airline, awards }) => ({
                                            label: airline.name,
                                            fill: false,
                                            pointRadius: 10,
                                            showLine: false,
                                            data: awards.map(award => ({
                                                x: award.date,
                                                y: award.name
                                            }))
                                        }))
                                    },
                                    options: {
                                        responsive: true,
                                        plugins: {
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Airline Awards',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                            }
                                        },
                                        elements: {
                                            point: {
                                                pointStyle: "star"
                                            }
                                        },
                                        scales: {
                                            xAxes: [
                                                {
                                                    display: true,
                                                    type: "time",
                                                    time: {
                                                        isoWeekday: true,
                                                        parser: "MM/DD/YYYY HH:mm",
                                                        unit: "day",
                                                        displayFormats: {
                                                            day: "MM/DD/YYYY"
                                                        }
                                                    },
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                    }
                                                },
                                            ],
                                            yAxes: [
                                                {
                                                    type: 'category',
                                                    position: 'left',
                                                    display: true,
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