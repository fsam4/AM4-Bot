import { Telegram as Utils } from '../../utils';
import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import QuickChart from 'quickchart-js';
import pug from 'pug';
import fs from 'fs';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import differenceInDays from 'date-fns/differenceInDays';
import addMonths from 'date-fns/addMonths';
import format from 'date-fns/format';

import type { Message, User, InputMediaPhoto } from 'typegram';
import type { Telegram, AM4 } from '@typings/database';
import type { Context } from 'telegraf';
import type { Command } from '@telegram/types';
import type { Member } from '@source/classes/alliance';

interface SceneSession extends Scenes.SceneSessionData {
    message: Message.TextMessage;
    user: User;
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const commandName = "member";

const sessionHandler = (ctx: SceneContext, next: () => void) => {
    ctx.scene.session.user ||= ctx.from;
    return next();
};

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: commandName,
    cooldown: 10,
    description: 'Search or compare alliance members',
    helpFileContent: fs.readFileSync("./documents/markdown/member.md", "utf8"),
    async execute(ctx, { timeouts }) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🔍 Search', 'search:member'),
            Markup.button.callback('📊 Compare', 'compare:member'),
            Markup.button.callback('❌ Exit', 'exit')
        ]);
        const reply_text = [
            "🔍: Search for a certain member",
            "📊: Compare members with charts"
        ]
        await ctx.replyWithMarkdown(reply_text.join('\n'), keyboard)
        .then(message => {
            const timeout = setTimeout(Utils.deleteMessage, 120000, ctx, message, timeouts);
            timeouts.set(message.message_id, timeout);
        });
    },
    actions: [
        {
            value: /(search|compare)(?=:member)/,
            execute: Utils.executeAction
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('search:member', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const memberCollection = database.am4.collection<AM4.AllianceMember>('Members');
                const keyboards = database.telegram.collection<Telegram.Keyboard>('Keyboards')
                const allianceCollection = database.am4.collection<AM4.Alliance>("Alliances");
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => void 0);
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: commandName });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Type the name or the ID of the member...\nFormat: `<name|id>`\nExample: `prestige wings`'];
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
                        const { airline, status: airlineStatus } = await rest.fetchAirline(input);
                        if (!airlineStatus.success) throw new TelegramClientError(airlineStatus.error);
                        if (!airline.alliance) throw new TelegramClientError('That user does not seem to be in an alliance, try searching with user ID if you are sure that this user is in an alliance.');
                        const { member } = await airline.alliance.fetchMember();
                        let memberDocument: AM4.AllianceMember;
                        const allianceDocument = await allianceCollection.findOne({ name: airline.alliance.name });
                        if (allianceDocument) {
                            memberDocument = await memberCollection.findOne({ 
                                name: airline.name, 
                                allianceID: allianceDocument._id 
                            });
                        }
                        if (!member) throw new TelegramClientError('That user does not seem to be in an alliance, try searching with user ID if you are sure that this user is in an alliance.');
                        const compile = pug.compileFile('client/telegram/layouts/member.pug');
                        const reply = compile({ 
                            member, airline, format, formatToString: formatDistanceToNowStrict, 
                            differenceInDays, locale, memberDocument 
                        });
                        if (!memberDocument || !memberDocument.dailyContribution.length) {
                            ctx.reply(reply, { parse_mode: 'HTML' });
                        } else {
                            const myChart = new QuickChart()
                            .setConfig({
                                type: "line",
                                data: {
                                    labels: memberDocument.dailyContribution.map(o => format(o.date, 'dd/MM')),
                                    datasets: [
                                        {
                                            lineTension: 0.4,
                                            label: "Contribution History",
                                            backgroundColor: "rgb(0, 255, 0, 1)",
                                            borderColor: "rgb(0, 255, 0, 1)",
                                            data: memberDocument.dailyContribution.map(o => o.value),
                                            fill: false,
                                        }
                                    ],
                                },
                                options: {
                                    plugins: {
                                        backgroundImageUrl: "https://i.ibb.co/Pj1bRk3/1601044842563.png",
                                        datalabels: {
                                            anchor: "end",
                                            align: "top",
                                            color: "#fff",
                                            backgroundColor: "rgba(34, 139, 34, 0.6)",
                                            borderColor: "rgba(34, 139, 34, 1.0)",
                                            borderWidth: 1,
                                            borderRadius: 5,
                                            formatter: (val: number) => {
                                                const k = val / 1000
                                                return "$" + k.toFixed(1) + 'k'
                                            },
                                        },
                                    },
                                    annotation: {
                                        annotations: [
                                            {
                                                type: "box",
                                                xScaleID: "x-axis-0",
                                                yScaleID: "y-axis-0",
                                                yMax: 10000,
                                                backgroundColor: "rgba(235, 0, 0, 0.3)",
                                                borderColor: "rgba(235, 0, 0, 1)",
                                            }
                                        ]
                                    },
                                    legend: {
                                        labels: {
                                            fontFamily: "Serif",
                                            fontColor: "white",
                                            fontSize: 13,
                                            usePointStyle: true
                                        },
                                    },
                                    scales: {
                                        yAxes: [{
                                            gridLines: {
                                                drawBorder: true,
                                                color: 'gray'
                                            },
                                            ticks: {
                                                padding: 5,
                                                fontFamily: "Serif",
                                                fontColor: "white",
                                                fontSize: 13,
                                                maxTicksLimit: 10,
                                                suggestedMin: Math.min(...memberDocument.dailyContribution.map(o => o.value)),
                                                callback: (val: number) => {
                                                    return "$" + val.toLocaleString('en');
                                                }
                                            }
                                        }],
                                        xAxes: [{
                                            gridLines: {
                                                display: false
                                            },
                                            ticks: {
                                                fontFamily: "Serif",
                                                fontColor: "white",
                                                fontSize: 13,
                                            }
                                        }]
                                    },
                                },
                            })
                            .setBackgroundColor("black");
                            const url = await myChart.getShortUrl();
                            const chartKeyboard = Markup.inlineKeyboard([Markup.button.url('Contribution Chart', url)]);
                            await ctx.replyWithHTML(reply, chartKeyboard);
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
                                            expireAt: addMonths(ctx.message.date * 1000, 1)
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
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('compare:member', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const memberCollection = database.am4.collection<AM4.AllianceMember>('Members');
                const allianceCollection = database.am4.collection<AM4.Alliance>("Alliances");
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    ctx.deleteMessage().catch(() => void 0);
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.replyWithMarkdown('Type the names or IDs of the members seperated by commas...\nFormat: `<name|id>,...`\nExample: `prestige wings, ambe airlines, world express airlines`', action_keyboard)
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const member_input = ctx.message.text.split(',').map(s => s.trim());
                        if (member_input.length < 2 || member_input.length > 5) throw new TelegramClientError('You need to provide 2-5 users...');
                        type MemberDocument = AM4.AllianceMember & { thisWeek: number };
                        type AllianceMember = Member & { document?: MemberDocument };
                        let members = await Promise.all<AllianceMember>(
                            member_input.map(async input => {
                                const { airline, status } = await rest.fetchAirline(Number(input) || input);
                                if (!status.success) throw new TelegramClientError(`*${input}:* ${status.error}`);
                                if (!airline.alliance) throw new TelegramClientError(`*${input}:* This user is not in an alliance`);
                                const response = await airline.alliance.fetchMember();
                                if (!response.status.success) throw new TelegramClientError(`*${input}:* ${response.status.error}`); 
                                return response.member;
                            })
                        );
                        const alliances = await allianceCollection.find({ name: { $in: members.map(member => member.alliance.name) } }).toArray();
                        const memberDocuments = await memberCollection.aggregate<MemberDocument>([
                            {
                                $match: {
                                    $or: members.map(member => {
                                        const alliance = alliances.find(alliance => alliance.name === member.alliance.name);
                                        return {
                                            name: member.airline.name,
                                            allianceID: alliance._id
                                        };
                                    })
                                }
                            },
                            {
                                $addFields: {
                                    thisWeek: {
                                        $sum: {
                                            $map: {
                                                input: '$dailyContribution',
                                                as: 'object',
                                                in: '$$object.value'
                                            }
                                        }
                                    }
                                } 
                            }
                        ]).toArray();
                        for (const memberDocument of memberDocuments) {
                            const member = members.find(member => member.airline.name === memberDocument.name);
                            if (member) member.document = memberDocument;
                        }
        
                        const graphs = [
                            {
                                emoji: '1️⃣',
                                description: "Line graph comparing the daily contribution history of the members.",
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: members.map(member => {
                                            const dataset = {
                                                lineTension: 0.4,
                                                label: member.airline.name,
                                                hidden: !member.document,
                                                fill: false,
                                                data: []
                                            };
                                            if (member.document) {
                                                dataset.data = member.document.dailyContribution.map(({ date, value }) => ({
                                                    x: date,
                                                    y: value
                                                }));
                                            }
                                            return dataset;
                                        })
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 0
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Daily Contribution',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                usePointStyle: true
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
                                                        fontColor: 'white',
                                                        fontSize: 13
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    type: 'time',
                                                    time: {
                                                        isoWeekday: true,
                                                        parser: "DD/MM/YYYY HH:mm",
                                                        unit: "day",
                                                        displayFormats: {
                                                            day: "DD/MM"
                                                        }
                                                    },
                                                    gridLines: {
                                                        display: false
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        fontSize: 13
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '2️⃣',
                                description: "Bubble graph comparing flights to contribution. The x-axis represents total contributon of the members and the y-axis represents the flights. The size of the bubble is determined by contribution today. Each thousand is +1 pixel in size.",
                                data: {
                                    type: 'bubble',
                                    data: {
                                        datasets: members.map(member => ({
                                            label: member.airline.name,
                                            borderWidth: 1,
                                            data: [
                                                {
                                                    x: member.contribution.total,
                                                    y: member.flights,
                                                    r: Math.round(member.contribution.daily / 1000),
                                                }
                                            ]
                                        }))
                                    },
                                    options: {
                                        title: {
                                            display: true,
                                            text: 'Contribution to flights',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        plugins: {
                                            tickFormat: {
                                                locale: 'en-US',
                                                useGrouping: true
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            },
                                            datalabels: {
                                                anchor: 'center',
                                                align: 'center',
                                                color: '#fff',
                                                font: {
                                                    weight: 'bold',
                                                    size: 7
                                                }
                                            },
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
                                                        labelString: 'Flights',
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
                                                        fontSize: 13
                                                    },
                                                },
                                            ],
                                            xAxes: [
                                                {
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Contribution',
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
                                                        fontSize: 13,
                                                        callback: (val: number) => `$${val.toLocaleString('en')}`
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '3️⃣',
                                description: "Bar Graph comparing the offline time each month of each user",
                                data: {
                                    type: 'bar',
                                    data: {
                                        datasets: members.map(member => {
                                            const dataset = {
                                                label: member.airline.name,
                                                borderWidth: 1,
                                                hidden: !member.document,
                                                data: []
                                            };
                                            if (member.document) {
                                                dataset.data = member.document.offline.map(({ value, date }) => ({
                                                    x: date,
                                                    y: value
                                                }));
                                            }
                                            return dataset;
                                        })
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'unit',
                                                unit: 'day'
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Offline Time',
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
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        padding: 5,
                                                        maxTicksLimit: 15,
                                                        suggestedMax: 5,
                                                        stepSize: 1,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        min: 0
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    type: 'time',
                                                    time: {
                                                        isoWeekday: true,
                                                        parser: "DD/MM/YYYY HH:mm",
                                                        unit: "month",
                                                        displayFormats: {
                                                            month: "MMMM YYYY"
                                                        }
                                                    },
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
                                emoji: '4️⃣',
                                description: "Violin graph comparing contribution this week. The top of the bar displays the highest contribution this week and the bottom displays the lowest. The width of the bar displays how much the member has member on average within the last 7 days.",
                                data: {
                                    type: 'violin',
                                    data: {
                                        labels: ["Contribution this week"],
                                        datasets: members.map(member => {
                                            const dataset = {
                                                label: 'Contribution this week',
                                                hidden: !member.document,
                                                borderWidth: 1,
                                                data: []
                                            };
                                            if (member.document) dataset.data = [member.document.dailyContribution.map(o => o.value)]
                                            return dataset;
                                        })
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 0
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: 'Contribution this week',
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
                                        },
                                        legend: {
                                            labels: {
                                                fontFamily: 'Serif',
                                                fontColor: 'white',
                                                fontSize: 16
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        fontSize: 16
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        fontSize: 16
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '5️⃣',
                                description: "Bar graph comparing the percentage of the member's contribution out of the total alliance's contribution.",
                                data: {
                                    type: 'bar',
                                    data: {
                                        labels: [...new Set(members.map(member => member.alliance.name))],
                                        datasets: members.map(member => ({
                                            label: member.airline.name,
                                            borderWidth: 4,
                                            data: [
                                                {
                                                    x: member.alliance.name,
                                                    y: member.contribution.total / member.alliance.contribution.total
                                                }
                                            ]
                                        }))
                                    },
                                    options: {
                                        plugins: {
                                            tickFormat: {
                                                style: 'percent',
                                                minimumFractionDigits: 2
                                            },
                                            colorschemes: {
                                                scheme: 'office.Celestial6'
                                            }
                                        },
                                        title: {
                                            display: true,
                                            text: "Portion of contribution",
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
            }
        }
    ]
}

export = command;