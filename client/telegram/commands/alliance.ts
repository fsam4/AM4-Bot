import { Telegram as Utils } from '../../utils';
import TelegramClientError from '../error';
import { Markup, Scenes } from 'telegraf';
import QuickChart from 'quickchart-js';
import pug from 'pug';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import differenceInDays from 'date-fns/differenceInDays';
import compareAsc from 'date-fns/compareAsc';
import addMonths from 'date-fns/addMonths';
import format from 'date-fns/format';

import type { Message, User, InputMediaPhoto } from 'typegram';
import type { Command, DataCallbackQuery } from '../types';
import type { Telegram, AM4_Data } from '@typings/database';
import type { Member } from '@source/classes/alliance';
import type { Context } from 'telegraf';
import type Alliance from '@source/classes/alliance';

interface AllianceMember extends AM4_Data.member {
    daysOffline: number;
    thisWeek: number;
    left: Date;
}

interface SceneSession extends Scenes.SceneSessionData {
    pages: Generator<string, string, number>;
    message: Message.TextMessage;
    alliances: Alliance[];
    user: User;
    input: string;
    sorting: {
        order: 'asc' | 'desc';
        path: string;
    };
}

type BaseSceneOptions = ConstructorParameters<typeof Scenes.BaseScene>[1];
type SceneContext = Scenes.SceneContext<SceneSession>;

const commandName = "alliance";

const sessionHandler = (ctx: SceneContext, next: () => void) => {
    ctx.scene.session.user ||= ctx.from;
    ctx.scene.session.alliances ||= [];
    ctx.scene.session.sorting ||= {
        order: undefined,
        path: undefined
    };
    return next();
};

const command: Command<Context, Scenes.SceneContext, SceneContext> = {
    name: commandName,
    cooldown: 10,
    description: 'Search or compare alliances',
    help: "This command can be used to search for an alliance and it's members or to compare alliances. The command has three choices which are search, members and compare. The search option has one required argument which is the name of the alliance. The members option has three required arguments: `<name>`, `<offline|contr_today|contr_total|sv>`, `<ascending|descending>`. `<name>` is the name of the alliance, `<offline|contr_today|contr_total|sv>` is the statistic to sort the members by and `<ascending|descending>` is the order to sort by. The last option is compare which can be used to compare alliances. It requires 2-5 alliance names that must be seperated by a comma.",
    async execute(ctx, { timeouts }) {
        const keyboard = Markup.inlineKeyboard([
            Markup.button.callback('🔍 Search', 'search:alliance'),
            Markup.button.callback('👪 Members', 'members:alliance'),
            Markup.button.callback('📊 Compare', 'compare:alliance')
        ]);
        const reply_text = [
            "🔍: Search for a specific alliance",
            "👪: Search and sort an alliance's members",
            "📊: Compare alliances with charts"
        ];
        await ctx.replyWithMarkdown(reply_text.join('\n'), keyboard)
        .then(message => {
            const timeout = setTimeout(Utils.deleteMessage, 120000, ctx, message, timeouts);
            timeouts.set(message.message_id, timeout);
        });
    },
    actions: [
        {
            value: /(search|members|compare)(?=:alliance)/,
            execute: Utils.executeAction
        }
    ],
    scenes: [
        {
            scene: new Scenes.BaseScene<SceneContext>('search:alliance', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const keyboards = database.telegram.collection<Telegram.keyboard>('Keyboards');
                const allianceCollection = database.am4.collection<AM4_Data.alliance>('Alliances');
                const memberCollection = database.am4.collection<AM4_Data.member>("Members");
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: commandName });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Type the name of the alliance...\nFormat: `<name>`\nExample: `air france klm`'];
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
                        const { status, alliance, members } = await rest.fetchAlliance(ctx.message.text);
                        if (!status.success) throw new TelegramClientError(status.error);
                        const allianceDocument = await allianceCollection.findOne({ name: alliance.name });
                        const compile = pug.compileFile('client/telegram/layouts/alliance.pug');
                        if (allianceDocument) {
                            const memberDocuments = await memberCollection.aggregate<AllianceMember>([
                                {
                                    $match: {
                                        allianceID: allianceDocument._id
                                    }
                                },
                                {
                                    $addFields: {
                                        thisWeek: {
                                            $sum: {
                                                $map: {
                                                    input: '$dailyContribution',
                                                    as: 'contr',
                                                    in: '$$contr.value'
                                                }
                                            }
                                        },
                                        daysOffline: { 
                                            $first: {
                                                $map: {
                                                    input: '$offline',
                                                    as: 'data',
                                                    in: '$$data.value'
                                                }
                                            }
                                        },
                                        left: {
                                            $cond: {
                                                if: {
                                                    $not: [{ $in: ["$name", members.map(member => member.airline.name)] }]
                                                },
                                                then: { 
                                                    $last: {
                                                        $map: {
                                                            input: '$sv',
                                                            as: 'data',
                                                            in: '$$data.date'
                                                        }
                                                    }
                                                },
                                                else: false
                                            }
                                        }
                                    }
                                }
                            ]).toArray();
                            const growth_chart = new QuickChart()
                            .setConfig({
                                type: 'line',
                                data: {
                                    datasets: [
                                        {
                                            label: 'Growth history',
                                            backgroundColor: 'rgb(25, 208, 231)',
                                            borderColor: 'rgb(25, 208, 231)',
                                            fill: false,
                                            data: allianceDocument.values.map(({ value, date }) => ({
                                                x: date,
                                                y: value
                                            }))
                                        }
                                    ]
                                },
                                options: {
                                    plugins: {
                                        tickFormat: {
                                            style: 'currency',
                                            currency: 'USD',
                                            minimumFractionDigits: 0
                                        },
                                        datalabels: {
                                            anchor: 'end',
                                            align: 'top',
                                            color: '#fff',
                                            backgroundColor: 'rgba(34, 139, 34, 0.6)',
                                            borderColor: 'rgba(34, 139, 34, 1.0)',
                                            borderWidth: 1,
                                            borderRadius: 5,
                                            formatter: (value: { x: Date, y: number }) => `$${value.y}`
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
                                    title: {
                                        display: true,
                                        text: 'Alliance Growth',
                                        fontFamily: 'Serif',
                                        fontColor: 'white',
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
                                                    parser: "MM/DD/YYYY HH:mm",
                                                    unit: "day",
                                                    displayFormats: {
                                                        day: "MM/DD"
                                                    }
                                                },
                                                gridLines: {
                                                    display: false
                                                },
                                                ticks: {
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    fontSize: 13,
                                                    maxTicksLimit: 7
                                                }
                                            }
                                        ]
                                    }
                                }
                            }).setBackgroundColor('transparent');
                            const url = await growth_chart.getShortUrl();
                            const keyboard = Markup.inlineKeyboard([Markup.button.url('Growth chart', url)]);
                            const reply = compile({
                                format, formatDistanceToNowStrict, compareAsc,
                                locale, memberDocuments, alliance, members, hasDocument: true
                            });
                            await ctx.replyWithHTML(reply, keyboard);
                        } else {
                            const reply = compile({
                                format, formatDistanceToNowStrict, compareAsc, 
                                alliance, members, locale 
                            });
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
        },
        {
            scene: new Scenes.BaseScene<SceneContext>('members:alliance', <BaseSceneOptions>{ ttl: 600000 }),
            async register({ database, rest }) {
                const keyboards = database.telegram.collection<Telegram.keyboard>('Keyboards');
                const memberCollection = database.am4.collection<AM4_Data.member>('Members');
                const allianceCollection = database.am4.collection<AM4_Data.alliance>("Alliances");
                const choices = [
                    {
                        name: 'Total Contribution',
                        value: 'contribution.total'
                    },
                    {
                        name: 'Contribution today',
                        value: 'contribution.today'
                    },
                    {
                        name: 'Contribution this week',
                        value: 'data.thisWeek'
                    },
                    {
                        name: 'Share Value',
                        value: 'sv'
                    },
                    {
                        name: 'Joining date',
                        value: 'joined'
                    },
                    {
                        name: 'Last online',
                        value: 'online.date'
                    },
                    {
                        name: 'Days offline',
                        value: 'data.daysOffline'
                    },
                    {
                        name: 'Flights',
                        value: 'flights'
                    }
                ];
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const keyboard = await keyboards.findOne({ id: ctx.from.id, command: commandName });
                    const content: Parameters<typeof ctx.replyWithMarkdown> = ['Type the name of the alliance...\nFormat: `<name>`\nExample: `air france klm`'];
                    if (keyboard) {
                        const columns = keyboard.input.length > 1 ? Math.trunc(keyboard.input.length / 2) : 1;
                        const markup = Markup.keyboard(keyboard.input, { columns }).oneTime(true);
                        content.push(markup);
                    }
                    await ctx.replyWithMarkdown(...content);
                });
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.input) return;
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    ctx.scene.session.input = ctx.message.text;
                    const response = await rest.fetchAlliance(ctx.message.text);
                    if (!response.status.success) {
                        await ctx.scene.leave();
                        return ctx.reply(response.status.error);
                    }
                    ctx.scene.session.alliances.push(response);
                    const buttons = choices.map(choice => Markup.button.callback(choice.name, choice.value));
                    buttons.push(Markup.button.callback('❌ Exit', 'delete'))
                    const keyboard = Markup.inlineKeyboard(buttons, { columns: 3 });
                    await ctx.reply('What statistic would you like to sort by?', keyboard);
                });
                const choice = new RegExp(choices.map(choice => choice.value).join('|'));
                this.scene.action(choice, async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    if (ctx.scene.session.sorting.path) return;
                    ctx.scene.session.sorting.path = (<DataCallbackQuery>ctx.callbackQuery).data;
                    await ctx.answerCbQuery();
                    const keyboard = Markup.inlineKeyboard([
                        Markup.button.callback('Ascending', 'asc'),
                        Markup.button.callback('Descending', 'desc'),
                        Markup.button.callback('❌ Exit', 'delete')
                    ], { columns: 2 });
                    await ctx.editMessageText('Choose the sorting order', keyboard);
                });
                this.scene.action(/asc|desc/, async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    if (ctx.scene.session.sorting.order) return;
                    const locale = ctx.from.language_code || 'en';
                    ctx.scene.session.sorting.order = (<DataCallbackQuery>ctx.callbackQuery).data as "asc" | "desc";
                    const { order, path: sort } = ctx.scene.session.sorting;
                    const [{ alliance, members: m }] = ctx.scene.session.alliances;
                    type MemberData = { data: AM4_Data.member & { thisWeek: number, daysOffline: number } };
                    let member_list = m.toArray() as Array<Member & MemberData>;
                    const allianceDocument = await allianceCollection.findOne({ name: alliance.name });
                    if (allianceDocument) {
                        type AllianceMemberDocument = AM4_Data.member & { thisWeek: number, daysOffline: number };
                        const memberDocuments = await memberCollection.aggregate<AllianceMemberDocument>([
                            {
                                $match: {
                                    allianceID: allianceDocument._id
                                }
                            },
                            {
                                $addFields: {
                                    thisWeek: {
                                        $sum: {
                                            $map: {
                                                input: '$dailyContribution',
                                                as: 'contr',
                                                in: '$$contr.value'
                                            }
                                        }
                                    },
                                    daysOffline: { 
                                        $last: {
                                            $map: {
                                                input: '$offline',
                                                as: 'data',
                                                in: '$$data.value'
                                            }
                                        }
                                    }
                                }
                            }
                        ]).toArray();
                        for (const member of member_list) member.data = memberDocuments.find(user => user.name === member.airline.name);
                    }
                    const path = sort.split('.');
                    member_list.sort((a, b) => {
                        let value_a: any = a, value_b: any = b;
                        for (const prop of path) {
                            if (!value_a || !value_b) break;
                            if (prop in value_a) value_a = value_a[prop];
                            if (prop in value_b) value_b = value_b[prop];
                        }
                        if (value_a instanceof Date) value_a = value_a.getTime();
                        if (value_b instanceof Date) value_b = value_b.getTime();
                        return (order === 'asc' ? (value_a - value_b) : (value_b - value_a));
                    });
                    const compile = pug.compileFile('client/telegram/layouts/member.pug');
                    const pages = member_list.map(({ data, ...member }) => compile({ member, data, format, differenceInDays, formatToString: formatDistanceToNowStrict, locale }));
                    const markup = Markup.inlineKeyboard([
                        Markup.button.callback('▶️', 'next'),
                        Markup.button.callback('🗑️', 'delete')
                    ]);
                    await ctx.answerCbQuery();
                    const msg = await ctx.editMessageText(pages[0], {
                        reply_markup: pages.length > 1 ? markup.reply_markup: undefined,
                        parse_mode: 'HTML'
                    });
                    if (pages.length === 1) await ctx.scene.leave();
                    ctx.scene.session.message = msg as Message.TextMessage;
                    ctx.scene.session.pages = pages.toGenerator();
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
                    await ctx.deleteMessage().catch(() => undefined);
                    await ctx.scene.leave();
                });
            }
        }, 
        {
            scene: new Scenes.BaseScene<SceneContext>('compare:alliance', <BaseSceneOptions>{ ttl: 120000 }),
            async register({ database, rest }) {
                const allianceCollection = database.am4.collection<AM4_Data.alliance>('Alliances');
                this.scene.use(sessionHandler);
                this.scene.enter(async (ctx) => {
                    await ctx.deleteMessage().catch(() => undefined);
                    const action_keyboard = Markup.inlineKeyboard([Markup.button.callback('❌ Exit', 'exit')]);
                    await ctx.replyWithMarkdown('Type the names of the alliances seperated by commas...\nFormat: `<name>,...`\nExample: `air france klm, starfleet, jetstar`', action_keyboard)
                })
                this.scene.on('text', async (ctx) => {
                    if (ctx.scene.session.user.id !== ctx.from.id) return;
                    await ctx.scene.leave();
                    try {
                        const alliance_input = ctx.message.text.split(',').map(s => s.trim());
                        if (alliance_input.length < 2 || alliance_input.length > 5) throw new TelegramClientError('You need to provide 2-5 alliances to compare...');
                        const alliances = await Promise.all<Alliance>(
                            alliance_input.map(async input => {
                                const response = await rest.fetchAlliance(input);
                                if (!response.status.success) throw new TelegramClientError(`*${input}:* ${response.status.error}`);
                                return response;
                            })
                        );
                        const data = await allianceCollection.find({ name: { $in: alliances.map(({ alliance }) => alliance.name) } }).toArray();

                        const graphs = [
                            {
                                emoji: '1️⃣',
                                description: 'Line graph comparing the growth of alliances from the past 7 days.',
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: data.map(alliance => ({
                                            label: alliance.name,
                                            fill: false,
                                            data: alliance.values.map(({ date, value }) => ({
                                                x: date,
                                                y: value
                                            }))
                                        }))
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
                                            text: 'Growth History',
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
                                                        unit: "day",
                                                        displayFormats: {
                                                            day: "MM/DD"
                                                        }
                                                    },
                                                    gridLines: {
                                                        display: false
                                                    },
                                                    ticks: {
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        maxTicksLimit: 24,
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: '2️⃣',
                                description: 'Scatter graph comparing contribution today to the amount of members. The y-axis represents the amount of members and the x-axis represents the total contribution of the alliance today.',
                                data: {
                                    type: 'scatter',
                                    data: {
                                        datasets: alliances.map(({ alliance }) => ({
                                            label: alliance.name,
                                            data: [
                                                {
                                                    x: alliance.contribution.daily,
                                                    y: alliance.members.amount,
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
                                        title: {
                                            display: true,
                                            text: 'Contribution today to member amount',
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
                                                    display: true,
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Members',
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
                                                    type: 'linear',
                                                    ticks: {
                                                        suggestedMax: 60,
                                                        suggestedMin: 1,
                                                        maxTicksLimit: 10,
                                                        stepSize: 1,
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
                                                        labelString: 'Contribution today',
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
                                emoji: '3️⃣',
                                description: "Scatter graph comparing the contribution and share value of the alliance's members. Each dot represents a member. The y-axis represents the share value of the members and the x-axis represents the contribution today.",
                                data: {
                                    type: 'scatter',
                                    data: {
                                        datasets: alliances.map(({ alliance, members }) => ({
                                            label: alliance.name,
                                            data: members.map(member => ({
                                                x: member.contribution.daily,
                                                y: member.sv
                                            }))
                                        }))
                                    },
                                    options: {
                                        annotation: {
                                            annotations: alliances.filter(({ alliance }) => alliance.ipo.required).map(({ alliance }) => ({
                                                type: 'line',
                                                mode: 'horizontal',
                                                scaleID: 'y-axis-0',
                                                value: alliance.ipo.value,
                                                borderColor: 'red',
                                                borderWidth: 2,
                                                label: {
                                                    enabled: true,
                                                    content: `Required SV: ${alliance.name}`
                                                }
                                            }))
                                        },
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
                                            text: 'Share value to contribution of members',
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
                                                    scaleLabel: {
                                                        display: true,
                                                        labelString: 'Share Value',
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
                                                    type: 'linear',
                                                    ticks: {
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
                                                        labelString: 'Contribution today',
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
                                emoji: '4️⃣',
                                description: 'Bar graph comparing total pax & cargo demand of the airports. The numbers represent the total demand of all routes combined. Left y-axis represents the pax demand and right y-axis represents the cargo demand. The right y-axis contains logarithmic values due to large numbers.',
                                data: {
                                    type: "line",
                                    data: {
                                        labels: alliances.map(({ alliance }) => alliance.name),
                                        datasets: [
                                            {
                                                label: "Rank",
                                                fill: false,
                                                pointRadius: 10,
                                                showLine: false,
                                                backgroundColor: "#87ceeb",
                                                borderColor: "#87ceeb",
                                                data: alliances.map(({ alliance }) => ({
                                                    x: alliance.name,
                                                    y: alliance.rank
                                                }))
                                            }
                                        ]
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
                                            text: 'Alliance Rank',
                                            fontFamily: 'Serif',
                                            fontColor: 'white',
                                        },
                                        legend: {
                                            display: false
                                        },
                                        elements: {
                                            point: {
                                                pointStyle: "star"
                                            }
                                        },
                                        scales: {
                                            yAxes: [
                                                {
                                                    type: 'linear',
                                                    position: 'left',
                                                    display: true,
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
                                                    },
                                                    ticks: {
                                                        padding: 5,
                                                        reverse: true,
                                                        fontFamily: 'Serif',
                                                        fontColor: 'white',
                                                        precision: 0,
                                                        callback: (val: number) => `rank ${val}`
                                                    }
                                                }
                                            ],
                                            xAxes: [
                                                {
                                                    type: "category",
                                                    display: true,
                                                    offset: true,
                                                    gridLines: {
                                                        drawBorder: true,
                                                        color: 'gray'
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
                this.scene.action('leave', async (ctx) => {
                    await ctx.answerCbQuery();
                    await ctx.deleteMessage().catch(() => undefined);
                    await ctx.scene.leave();
                });
            }
        }
    ]
}

export = command;