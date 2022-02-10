import { MessageEmbed, Permissions, MessageSelectMenu, Formatters, MessageActionRow, Constants, type MessageComponentInteraction, type Message } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import differenceInWeeks from 'date-fns/differenceInWeeks';
import differenceInDays from 'date-fns/differenceInDays';
import compareAsc from 'date-fns/compareAsc';
import addDays from 'date-fns/addDays';

import type { SlashCommand } from '@discord/types';
import type { Member } from '@source/classes/alliance';
import type Alliance from '@source/classes/alliance';
import type { AM4 } from '@typings/database';

interface AllianceMember extends AM4.AllianceMember {
    daysOffline: number;
    thisWeek: number;
    left: Date;
}

const sort_choices = [
    {
        name: 'Total Contribution',
        value: 'contribution.total'
    },
    {
        name: 'Contribution today',
        value: 'contribution.daily'
    },
    {
        name: 'Contribution this week',
        value: 'data.thisWeek'
    },
    {
        name: 'Share Value',
        value: 'shareValue'
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
    },
    {
        name: 'Avg. contribution/flight',
        value: 'contribution.average.flight'
    },
    {
        name: 'Avg. contribution/day',
        value: 'contribution.average.day'
    },
    {
        name: 'Avg. contribution/week',
        value: 'contribution.average.week'
    }
];

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS
    ]),
    data: {
        name: 'alliance',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Search or compare alliances',
        defaultPermission: true,
        options: [
            {
                name: 'search',
                description: 'Search for an alliance.',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'name',
                        description: 'The name of the alliance. Leave empty for the alliance of your own airline.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: 'compare',
                description: 'Compare alliances with graphs',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'alliance_1',
                        description: 'The name of the alliance',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'alliance_2',
                        description: 'The name of the alliance',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'alliance_3',
                        description: 'The name of the alliance',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'alliance_4',
                        description: 'The name of the alliance',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'alliance_5',
                        description: 'The name of the alliance',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: 'members',
                description: "Search, compare and sort an alliance's members",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: "sort",
                        description: "Sort an alliance's members",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'alliance',
                                description: 'The name of the alliance',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: 'sort',
                                description: 'The statistic to sort members by',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true,
                                choices: sort_choices
                            },
                            {
                                name: 'order',
                                description: 'Whether to sort members in ascending or descending order. By default sorted in descending order.',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false,
                                choices: [
                                    {
                                        name: 'Ascending',
                                        value: 'asc'
                                    },
                                    {
                                        name: 'Descending',
                                        value: 'desc'
                                    }
                                ]
                            },
                            {
                                name: 'amount',
                                description: 'The amount of members (1-60) to display. By default all members.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                maxValue: 60,
                                required: false
                            }
                        ]
                    },
                    {
                        name: "search",
                        description: "Search for a specific alliance member",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'name',
                                description: 'The username of the airline. Only fill in one of the 2 arguments.',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: 'id',
                                description: 'The ID of the airline. Only fill in one of the 2 arguments.',
                                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                                minValue: 1,
                                required: false
                            }
                        ]
                    },
                    {
                        name: 'compare',
                        description: 'Returns charts that compare the specified members',
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: 'member_1',
                                description: 'Type the name or ID of the airline',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: 'member_2',
                                description: 'Type the name or ID of the airline',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: 'member_3',
                                description: 'Type the name or ID of the airline',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: 'member_4',
                                description: 'Type the name or ID of the airline',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: 'member_5',
                                description: 'Type the name or ID of the airline',
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            }
                        ]
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, rest, account, ephemeral, locale }) {
        await interaction.deferReply({ ephemeral });
        try {
            const allianceCollection = database.am4.collection<AM4.Alliance>('Alliances');
            const memberCollection = database.am4.collection<AM4.AllianceMember>('Members');
            const subCommand = interaction.options.getSubcommand();
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "search": {
                    let res: Alliance;
                    const input = interaction.options.getString("name");
                    if (input) {
                        res = await rest.fetchAlliance(input);
                    } else {
                        if (!account?.airlineID) throw new DiscordClientError("You need to define the alliance name or login with `/user login` to see your current alliance.");
                        const { status, airline } = await rest.fetchAirline(account.airlineID);
                        if (!status.success) throw new DiscordClientError(status.error);
                        if (!airline.alliance) throw new DiscordClientError('You do not seem to currently be in an alliance...');
                        res = await airline.alliance.fetch();
                    }
                    const { alliance, members, status } = res;
                    if (!status.success) throw new DiscordClientError(status.error);
                    const recentlyJoined = members.sort((a, b) => compareAsc(b.joined, a.joined)).toArray().slice(0, 5);
                    const embed = new MessageEmbed({
                        title: alliance.name,
                        color: "BLURPLE",
                        timestamp: alliance.founded,
                        footer: {
                            text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        },
                        fields: [
                            {
                                name: Formatters.bold(Formatters.underscore("Statistics")),
                                value: `**Rank:** ${alliance.rank.toLocaleString(locale)}\n**Founded:** ${Formatters.time(alliance.founded, "D")}\n**Value:** $${alliance.value.toLocaleString(locale)}\n**Flights:** ${alliance.flights.toLocaleString(locale)}\n**Total contribution:** $${alliance.contribution.total.toLocaleString(locale)}`,
                                inline: false
                            },
                            {
                                name: Formatters.bold(Formatters.underscore("Members")),
                                value: `**Members:** ${alliance.members.amount.toLocaleString(locale)}/${alliance.members.max.toLocaleString(locale)}\n**Requirements:** ${alliance.ipo.required ? `$${alliance.ipo.value.toLocaleString(locale)} SV` : 'No IPO required'}\n**Contribution today:** $${alliance.contribution.daily.toLocaleString(locale)}\n**Average contribution:** $${Math.round(alliance.contribution.daily / alliance.members.amount).toLocaleString(locale)}/member`,
                                inline: false
                            },
                            {
                                name: Formatters.bold(Formatters.underscore("Recently joined")),
                                value: Formatters.codeBlock(recentlyJoined.map(member => `${member.airline.name} (${formatDistanceToNowStrict(member.joined, { addSuffix: true, unit: 'day' })})`).join('\n')),
                                inline: true
                            }
                        ]
                    });
                    if (alliance.inSeason) embed.fields[0].value += `\n**Season contribution:** $${alliance.contribution.season.toLocaleString(locale)}`;
                    const allianceData = await allianceCollection.findOne({ name: alliance.name });
                    if (allianceData) {
                        const memberDocuments = await memberCollection.aggregate<AllianceMember>([
                            {
                                $match: {
                                    allianceID: allianceData._id
                                }
                            },
                            {
                                $addFields: {
                                    thisWeek: {
                                        $sum: {
                                            $map: {
                                                input: '$dailyContribution',
                                                as: 'daily',
                                                in: '$$daily.value'
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
                                                        input: '$shareValue',
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
                        const recently_left = memberDocuments.filter(member => member.left).sort((a, b) => compareAsc(b.left, a.left)).slice(0, 5);
                        if (recently_left.length) embed.addFields({
                            name: Formatters.bold(Formatters.underscore("Recently left")),
                            value: Formatters.codeBlock(recently_left.map(member => `${member.name} (${formatDistanceToNowStrict(member.left, { addSuffix: true, unit: 'day' })})`).join('\n')),
                            inline: true
                        });
                        const growth = allianceData.values.map(({ value }) => value).difference();
                        const charts: Array<{ [key: string]: any }> = [
                            {
                                emoji: "📈",
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'Alliance Value',
                                                backgroundColor: 'rgb(25, 208, 231)',
                                                borderColor: 'rgb(25, 208, 231)',
                                                fill: false,
                                                data: allianceData.values.map(({ value, date }) => ({
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
                                            display: false,
                                            text: 'Alliance Growth',
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
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
                                                        fontSize: 13,
                                                        maxTicksLimit: 7
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                emoji: emojis.payraise,
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: memberDocuments.filter(member => !member.left).map(member => ({
                                            lineTension: 0.4,
                                            label: member.name,
                                            fill: false,
                                            data: member.dailyContribution.map(({ date, value }) => ({
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
                                            text: "Contribution",
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
                                        },
                                        legend: {
                                            display: false,
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
                            }
                        ];
                        if (allianceData.values.length > 2) {
                            charts.push({
                                emoji: "🔮",
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'Lowest',
                                                borderDash: [5, 5],
                                                backgroundColor: 'rgb(246, 15, 15)',
                                                borderColor: 'rgb(246, 15, 15)',
                                                fill: false,
                                                data: Array(growth.length + 1).fill(alliance.value).map((value, i) => {
                                                    const growthValue = Math.min(...growth);
                                                    const yValue = value + growthValue * i;
                                                    return {
                                                        x: addDays(interaction.createdAt, i),
                                                        y: yValue < 0 ? 0 : yValue
                                                    }
                                                })
                                            },
                                            {
                                                label: 'Estimated',
                                                borderDash: [5, 5],
                                                backgroundColor: 'rgb(25, 208, 231)',
                                                borderColor: 'rgb(25, 208, 231)',
                                                fill: false,
                                                data: Array(growth.length + 1).fill(alliance.value).map((value, i) => {
                                                    const growthValue = growth.reduce((a, b) => a + b) / growth.length;
                                                    return {
                                                        x: addDays(interaction.createdAt, i),
                                                        y: value + growthValue * i
                                                    }
                                                })
                                            },
                                            {
                                                label: 'Highest',
                                                borderDash: [5, 5],
                                                backgroundColor: 'rgb(16, 242, 69)',
                                                borderColor: 'rgb(16, 242, 69)',
                                                fill: false,
                                                data: Array(growth.length + 1).fill(alliance.value).map((value, i) => {
                                                    const growthValue = Math.max(...growth);
                                                    return {
                                                        x: addDays(interaction.createdAt, i),
                                                        y: value + growthValue * i
                                                    }
                                                })
                                            }
                                        ]
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
                                        title: {
                                            display: true,
                                            text: 'Growth Prediction',
                                            fontFamily: 'Serif',
                                            fontColor: 'white'
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
                                                        fontSize: 13,
                                                        maxTicksLimit: 7
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            });
                        }
                        const options = await Promise.all(
                            charts.map(async (chart, index) => {
                                const graph = new QuickChart()
                                .setBackgroundColor('transparent')
                                .setConfig(chart.data);
                                return {
                                    label: chart.data.options.title.text,
                                    value: await graph.getShortUrl(),
                                    default: !index,
                                    emoji: chart.emoji
                                }
                            })
                        );
                        const select = new MessageSelectMenu({
                            customId: "graph",
                            placeholder: "Select graph...",
                            options: options
                        });
                        const row = new MessageActionRow({ components: [select] });
                        embed.setImage(options[0].value);
                        const message = await interaction.editReply({
                            embeds: [embed],
                            components: [row]
                        }) as Message;
                        const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                        const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                        collector.on("collect", async interaction => {
                            if (interaction.isSelectMenu()) {
                                const url = interaction.values[0];
                                for (const option of select.options) option.default = (url === option.value);
                                row.setComponents(select);
                                await interaction.update({
                                    embeds: [embed.setImage(url)],
                                    components: [row]
                                });
                            }
                        });
                        collector.once("end", async collected => {
                            row.setComponents(select.setDisabled(true));
                            const reply = collected.last() || interaction;
                            await reply.editReply({ components: [row] }).catch(() => void 0);;
                        });
                    } else {
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case "compare": {
                    const options = interaction.options.data[0].options.filter(option => option.name.startsWith("alliance"));
                    type AllianceData = Alliance & { data?: AM4.Alliance };
                    const alliances = await Promise.all<AllianceData>(
                        options.map(async option => {
                            const response = await rest.fetchAlliance(<string>option.value);
                            if (!response.status.success) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} ${response.status.error}`);
                            return response;
                        })
                    );
                    const allianceDocuments = await allianceCollection.find({ name: { $in: alliances.map(({ alliance }) => alliance.name) } }).toArray();
                    for (const allianceDocument of allianceDocuments) {
                        const alliance = alliances.find(({ alliance }) => alliance.name === allianceDocument.name);
                        if (alliance) alliance.data = allianceDocument;
                    }
                    const graphs = [
                        {
                            id: new ObjectId(),
                            type: "Line graph",
                            description: "Line graph comparing the growth of the alliances' from the past 7 days. This graph only displays the alliances with growth data collected.",
                            data: {
                                type: 'line',
                                data: {
                                    datasets: alliances.map(({ alliance, data }) =>{
                                        const dataset = {
                                            label: alliance.name,
                                            hidden: data ? false : true,
                                            fill: false,
                                            data: []
                                        };
                                        if (data) dataset.data = data.values.map(({ date, value }) => ({
                                            x: date,
                                            y: value
                                        }));
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
                                                    maxTicksLimit: 24,
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            id: new ObjectId(),
                            type: "Bar graph",
                            description: "Bar graph comparing the total contribution today and this season of the alliances.",
                            data: {
                                type: 'bar',
                                data: {
                                    labels: [
                                        "Total contribution today",
                                        "Total contribution this season"
                                    ],
                                    datasets: alliances.map(({ alliance }) => ({
                                        label: alliance.name,
                                        data: [
                                            alliance.contribution.daily,
                                            alliance.contribution.season || 0
                                        ]
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
                                        text: 'Total contribution today',
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
                            id: new ObjectId(),
                            type: "Scatter graph",
                            description: "Scatter graph comparing the contribution and SV of the alliance's members. The y-axis displays the SV of the member and the x-axis displays the contribution today. The red lines display the required SV of each alliance.",
                            data: {
                                type: 'scatter',
                                data: {
                                    datasets: alliances.map(({ alliance, members }) => ({
                                        label: alliance.name,
                                        data: members.map(member => ({
                                            x: member.contribution.daily,
                                            y: member.shareValue
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
                                        text: 'Alliance members',
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
                            id: new ObjectId(),
                            type: "Line graph",
                            description: "Line graphs comparing the ranks of the alliances. This line graph is not a typical line graph as it does not have the line itself. The dots displays the ranks of each alliances.",
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
                    const select = new MessageSelectMenu({ 
                        customId: "chart", 
                        placeholder: "Select a graph...",
                        maxValues: 1,
                        minValues: 1,
                        options: graphs.map((graph, i) => ({
                            label: graph.data.options.title.text,
                            description: graph.type,
                            value: graph.id.toHexString(),
                            default: i === 0
                        }))
                    });
                    const chart = new QuickChart()
                    .setConfig(graphs[0].data)
                    .setBackgroundColor("transparent");
                    const embed = new MessageEmbed({
                        color: 15105570,
                        title: "Alliance comparing",
                        description: graphs[0].description,
                        image: {
                            url: await chart.getShortUrl()
                        },
                        footer: {
                            text: `Requests remaining: ${alliances.last().status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        }
                    });
                    const row = new MessageActionRow({ components: [select] });
                    const message = await interaction.editReply({ 
                        embeds: [embed], 
                        components: [row] 
                    }) as Message;
                    const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                    const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                    collector.on("collect", async interaction => {
                        if (interaction.isSelectMenu()) {
                            const value = interaction.values[0];
                            const graph = graphs.find(graph => graph.id.equals(value));
                            embed.setDescription(graph.description);
                            const chart = new QuickChart()
                            .setConfig(graph.data)
                            .setBackgroundColor("transparent");
                            const url = await chart.getShortUrl();
                            for (const option of select.options) option.default = (value === option.value);
                            row.setComponents(select);
                            await interaction.update({ 
                                embeds: [embed.setImage(url)],
                                components: [row]
                            });
                        }
                    });
                    collector.once("end", async collected => {
                        row.setComponents(select.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(() => void 0);
                    });
                    break;
                }
                case "members": {
                    switch(subCommand) {
                        case "sort": {
                            type OrderType = "asc" | "desc";
                            const input = interaction.options.getString("alliance", true);
                            let sort = interaction.options.getString("sort");
                            let order = <OrderType>interaction.options.getString("order")
                            const amount = interaction.options.getInteger("amount");
                            const { members, alliance, status } = await rest.fetchAlliance(input);
                            if (!status.success) throw new DiscordClientError(status.error);
                            type AllianceMember = AM4.AllianceMember & { thisWeek: number, daysOffline: number };
                            type AllianceMemberData = Member & { data: AllianceMember };
                            let memberList = <AllianceMemberData[]>members.toArray();
                            const allianceDocument = await allianceCollection.findOne({ name: alliance.name });
                            if (allianceDocument) {
                                const users = await memberCollection.aggregate<AllianceMember>([
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
                                            }
                                        }
                                    }
                                ]).toArray();
                                for (const member of memberList) member.data = users.find(user => user.name === member.airline.name);
                            }
                            let path = sort.split('.');
                            type F = Parameters<typeof memberList.sort>[number]
                            const sortFunction: F = (a, b) => {
                                let value_a: any = a, value_b: any = b;
                                for (const prop of path) {
                                    if (!value_a || !value_b) break;
                                    if (prop in value_a) value_a = value_a[prop];
                                    if (prop in value_b) value_b = value_b[prop];
                                }
                                if (value_a instanceof Date) value_a = value_a.getTime();
                                if (value_b instanceof Date) value_b = value_b.getTime();
                                return (order === 'asc' ? (value_a - value_b) : (value_b - value_a));
                            };
                            memberList.sort(sortFunction);
                            if (amount) memberList = memberList.slice(0, amount);
                            const embed = new MessageEmbed({
                                color: "BLURPLE",
                                timestamp: alliance.founded,
                                title: `${alliance.name + (alliance.name.endsWith('s') ? "'" : "'s")} members`,
                                footer: {
                                    text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                                }
                            });
                            const moneyValue = /contribution|shareValue|thisWeek/;
                            const formatFunction = (member: AllianceMemberData, i: number) => {
                                const string = `${Formatters.bold(`${i + 1}.`)} ${member.airline.name}`;
                                let value: any = member;
                                for (const prop of path) {
                                    if (prop in value) value = value[prop];
                                    if (!value) {
                                        value = 0;
                                        break;
                                    }
                                };
                                if (value instanceof Date) {
                                    value = formatDistanceToNowStrict(value)
                                    .replace(/ second(s|)/g, 's')
                                    .replace(/ minute(s|)/g, 'min')
                                    .replace(/ hour(s|)/g, 'h')
                                    .replace(/ day(s|)/g, 'd')
                                    .replace(/ month(s|)/g, 'm')
                                    .replace(/ year(s|)/g, 'y')
                                } else {
                                    value = Math.round(value).abbreviate();
                                    if (moneyValue.test(sort)) value = `$${value}`;
                                }
                                return `${string} (${Formatters.italic(value)})`;
                            };
                            let values = memberList.map(formatFunction);
                            let sections = 1;
                            let fields = values.split(sections);
                            while(fields.some(values => values.map(string => string.length).reduce((a, b) => a + b) > 1000)) {
                                sections++;
                                fields = values.split(sections);
                            }
                            embed.addFields(fields.map(values => ({
                                name: '\u200B',
                                value: values.join('\n'),
                                inline: true
                            })));
                            const sortSelect = new MessageSelectMenu({
                                customId: "sort",
                                maxValues: 1,
                                minValues: 1,
                                placeholder: "Sorting by...",
                                options: sort_choices.map(choice => ({
                                    label: choice.name,
                                    value: choice.value,
                                    default: choice.value === sort
                                }))
                            });
                            const orderSelect = new MessageSelectMenu({
                                customId: "order",
                                maxValues: 1,
                                minValues: 1,
                                placeholder: "Order...",
                                options: [
                                    {
                                        label: "Ascending",
                                        value: "asc",
                                        default: order === "asc"
                                    },
                                    {
                                        label: "Descending",
                                        value: "desc",
                                        default: order === "desc"
                                    }
                                ]
                            });
                            const sortRow = new MessageActionRow({ components: [sortSelect] });
                            const orderRow = new MessageActionRow({ components: [orderSelect] });
                            const message = await interaction.editReply({ 
                                embeds: [embed],
                                components: [
                                    sortRow,
                                    orderRow
                                ]
                            }) as Message;
                            const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                            const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                            collector.on("collect", async interaction => {
                                await interaction.deferUpdate();
                                if (interaction.isSelectMenu()) {
                                    if (interaction.customId === "sort") {
                                        sort = interaction.values[0];
                                        path = sort.split('.');
                                        for (const option of sortSelect.options) {
                                            option.default = option.value === sort;
                                        }
                                    } else {
                                        order = <typeof order>interaction.values[0];
                                        for (const option of orderSelect.options) {
                                            option.default = option.value === order;
                                        }
                                    }
                                }
                                memberList.sort(sortFunction);
                                values = memberList.map(formatFunction);
                                sections = 1;
                                fields = values.split(sections);
                                while(fields.some(values => values.map(string => string.length).reduce((a, b) => a + b) > 1000)) {
                                    sections++;
                                    fields = values.split(sections);
                                }
                                embed.fields = fields.map(values => ({
                                    name: '\u200B',
                                    value: values.join('\n'),
                                    inline: true
                                }));
                                await interaction.editReply({ 
                                    embeds: [embed],
                                    components: [
                                        new MessageActionRow({ components: [sortSelect] }),
                                        new MessageActionRow({ components: [orderSelect] })
                                    ]
                                });
                            });
                            collector.once("end", async collected => {
                                const reply = collected.last() || interaction;
                                sortRow.setComponents(sortSelect.setDisabled(true));
                                orderRow.setComponents(orderSelect.setDisabled(true));
                                await reply.editReply({ components: [sortRow, orderRow] })
                                .catch(() => void 0);
                            });
                            break;
                        }
                        case "search": {
                            const input = interaction.options.getInteger("id") || interaction.options.getString("name");
                            if (!input && !account?.airlineID) throw new DiscordClientError("You need define at least one of the arguments or login with `/user login` to see your own airline!");
                            const { airline, status: airlineStatus } = await rest.fetchAirline(input || account.airlineID);
                            if (!airlineStatus.success) throw new DiscordClientError(airlineStatus.error);
                            if (!airline.alliance) throw new DiscordClientError('That airline does not seem to be in an alliance currently...');
                            const { member, status } = await airline.alliance.fetchMember();
                            if (!status.success) throw new DiscordClientError(status.error);
                            const days = Math.abs(differenceInDays(interaction.createdAt, member.joined));
                            const weeks = Math.abs(differenceInWeeks(interaction.createdAt, member.joined));
                            const charts: Array<{ emoji: string, data: { [key: string]: any } }> = [];
                            const embed = new MessageEmbed({
                                color: "BLURPLE",
                                timestamp: airline.founded,
                                author: {
                                    name: `${member.airline.name} (${member.alliance.name}) ${airline.online ? '🟢': '🔴'}`,
                                    iconURL: airline.displayLogoURL,
                                    url: airline.displayLogoURL
                                },
                                footer: {
                                    text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                                },
                                fields: [
                                    {
                                        name: Formatters.bold(Formatters.underscore("General Statistics")),
                                        value: `**Share value:** $${member.shareValue.toLocaleString(locale)}\n**Joined:** ${Formatters.time(member.joined)}\n**Last online:** ${Formatters.time(member.online, "R")}\n**Flights:** ${(member.flights).toLocaleString(locale)}`,
                                        inline: false
                                    },
                                    {
                                        name: Formatters.bold(Formatters.underscore("Contribution")),
                                        value: `**Total:** $${member.contribution.total.toLocaleString(locale)}\n**Today:** $${member.contribution.daily.toLocaleString(locale)}`,
                                        inline: false
                                    },
                                    {
                                        name: Formatters.bold(Formatters.underscore("Averages")),
                                        value: `**Per day:** $${Math.round(days > 0 ? member.contribution.total / days : member.contribution.total).toLocaleString(locale)}\n**Per week:** $${Math.round(weeks > 0 ? member.contribution.total / weeks : member.contribution.total).toLocaleString(locale)}\n**Per flight:** $${(member.contribution.total / member.flights).toFixed(2)}`,
                                        inline: false
                                    }
                                ]
                            });
                            const allianceDocument = await allianceCollection.findOne({ name: airline.alliance.name });
                            if (allianceDocument) {
                                const memberDocument = await memberCollection.findOne({ 
                                    name: airline.name, 
                                    allianceID: allianceDocument._id 
                                });
                                if (memberDocument) {
                                    if (memberDocument.dailyContribution.length) {
                                        const thisWeek = Math.round(memberDocument.dailyContribution.map(o => o.value).reduce((total, value) => total + value));
                                        const average = Math.round(thisWeek / memberDocument.dailyContribution.length);
                                        embed.fields[1].value += `\n**This week:** $${thisWeek.toLocaleString(locale)}`;
                                        embed.fields[2].value += `\n**This week:** $${average.toLocaleString(locale)}/day`;
                                        charts.push({
                                            emoji: emojis.payraise,
                                            data: {
                                                type: "line",
                                                data: {
                                                    datasets: [
                                                        {
                                                            lineTension: 0.4,
                                                            label: "Contribution History",
                                                            backgroundColor: "rgb(0, 255, 0, 1)",
                                                            borderColor: "rgb(0, 255, 0, 1)",
                                                            fill: false,
                                                            data: memberDocument.dailyContribution.map(({ value, date }) => ({
                                                                x: date,
                                                                y: value
                                                            }))
                                                        }
                                                    ],
                                                },
                                                options: {
                                                    plugins: {
                                                        backgroundImageUrl: "https://i.ibb.co/Pj1bRk3/1601044842563.png",
                                                        tickFormat: {
                                                            style: 'currency',
                                                            currency: 'USD',
                                                            minimumFractionDigits: 0
                                                        },
                                                        datalabels: {
                                                            anchor: "end",
                                                            align: "top",
                                                            color: "#fff",
                                                            backgroundColor: "rgba(34, 139, 34, 0.6)",
                                                            borderColor: "rgba(34, 139, 34, 1.0)",
                                                            borderWidth: 1,
                                                            borderRadius: 5,
                                                            formatter: (value: { x: Date, y: number }) => {
                                                                const k = value.y / 1000
                                                                return "$" + k.toFixed(1) + 'k'
                                                            }
                                                        }
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
                                                        }
                                                    },
                                                    title: {
                                                        display: false,
                                                        text: 'Contribution History',
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
                                                                    fontFamily: "Serif",
                                                                    fontColor: "white",
                                                                    fontSize: 13,
                                                                    maxTicksLimit: 10,
                                                                    suggestedMin: Math.min(...memberDocument.dailyContribution.map(o => o.value))
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
                                                                    fontFamily: "Serif",
                                                                    fontColor: "white",
                                                                    fontSize: 13,
                                                                    maxTicksLimit: 7
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    if (memberDocument.shareValue.length) {
                                        charts.push({
                                            emoji: emojis.stock,
                                            data: {
                                                type: "line",
                                                data: {
                                                    datasets: [
                                                        {
                                                            lineTension: 0.4,
                                                            label: "Share Value",
                                                            backgroundColor: "rgb(0, 255, 0, 1)",
                                                            borderColor: "rgb(0, 255, 0, 1)",
                                                            fill: false,
                                                            data: memberDocument.shareValue.map(({ value, date }) => ({
                                                                x: date,
                                                                y: value
                                                            }))
                                                        }
                                                    ]
                                                },
                                                options: {
                                                    plugins: {
                                                        backgroundImageUrl: "https://i.ibb.co/Pj1bRk3/1601044842563.png",
                                                        tickFormat: {
                                                            style: 'currency',
                                                            currency: 'USD',
                                                            minimumFractionDigits: 0
                                                        },
                                                        datalabels: {
                                                            anchor: "end",
                                                            align: "top",
                                                            color: "#fff",
                                                            backgroundColor: "rgba(34, 139, 34, 0.6)",
                                                            borderColor: "rgba(34, 139, 34, 1.0)",
                                                            borderWidth: 1,
                                                            borderRadius: 5,
                                                            formatter: (value: { x: Date, y: number }) => `$${value.y}`
                                                        }
                                                    },
                                                    legend: {
                                                        labels: {
                                                            fontFamily: "Serif",
                                                            fontColor: "white",
                                                            fontSize: 13,
                                                            usePointStyle: true
                                                        }
                                                    },
                                                    title: {
                                                        display: false,
                                                        text: 'Share Value Growth',
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
                                                                    fontFamily: "Serif",
                                                                    fontColor: "white",
                                                                    fontSize: 13,
                                                                    maxTicksLimit: 10
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
                                                                    fontFamily: "Serif",
                                                                    fontColor: "white",
                                                                    fontSize: 13,
                                                                    maxTicksLimit: 7
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                            if (member.contribution.season) embed.fields[1].value += `\n**Season:** $${member.contribution.season.toLocaleString(locale)}`;
                            if (charts.length) {
                                const options = await Promise.all(
                                    charts.map(async (chart, i) => {
                                        const graph = new QuickChart()
                                        .setBackgroundColor('transparent')
                                        .setConfig(chart.data);
                                        return {
                                            label: chart.data.options.title.text,
                                            value: await graph.getShortUrl(),
                                            default: i === 0,
                                            emoji: chart.emoji
                                        }
                                    })
                                );
                                const select = new MessageSelectMenu({
                                    customId: "graph",
                                    placeholder: "Select graph...",
                                    options: options
                                });
                                const row = new MessageActionRow({ components: [select] });
                                embed.setImage(options[0].value);
                                const message = await interaction.editReply({
                                    embeds: [embed],
                                    components: [row]
                                }) as Message;
                                const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                                const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                                collector.on("collect", async interaction => {
                                    if (interaction.isSelectMenu()) {
                                        const url = interaction.values[0];
                                        for (const option of select.options) option.default = (url === option.value);
                                        row.setComponents(select);
                                        await interaction.update({
                                            embeds: [embed.setImage(url)],
                                            components: [row]
                                        });
                                    }
                                });
                                collector.once("end", async collected => {
                                    row.setComponents(select.setDisabled(true));
                                    const reply = collected.last() || interaction;
                                    await reply.editReply({ components: [row] }).catch(() => void 0);
                                });
                            } else {
                                await interaction.editReply({ embeds: [embed] });
                            }
                            break;
                        }
                        case "compare": {
                            const options = interaction.options.data[0].options[0].options.filter(option => option.name.startsWith("member"));
                            type MemberDocument = AM4.AllianceMember & { thisWeek: number };
                            type AllianceMember = Member & { document?: MemberDocument };
                            let requestsRemaining: number;
                            const members = await Promise.all<AllianceMember>(
                                options.map(async option => {
                                    const { airline, status } = await rest.fetchAirline(Number(option.value) || <string>option.value);
                                    if (!status.success) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} ${status.error}`);
                                    if (!airline.alliance) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} This airline does not seem to be in an alliance...`);
                                    const response = await airline.alliance.fetchMember();
                                    if (!response.status.success) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} ${response.status.error}`);
                                    requestsRemaining = response.status.requestsRemaining; 
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
                                    id: new ObjectId(),
                                    type: "Line graph",
                                    description: "Line graph comparing the contribution history of the past 7 days of the members. The graph only displays members who have contribution data collected.",
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
                                    id: new ObjectId(),
                                    type: "Bubble graph",
                                    description: "Bubble graph comparing total contribution to flights. The y-axis displays the total flights and the x-axis displays the total contribution of the members. The ball size is determined by the daily contribution. Each 1k contribution today is one pixel in size.",
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
                                    id: new ObjectId(),
                                    type: "Bar graph",
                                    description: "Bar graph comparing the offline time of the members in days each month. This only displays members that have activity data collected.",
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
                                    id: new ObjectId(),
                                    type: "Violin graph",
                                    description: "Violin graph comparing the total contribution this week. The heigth of the graphs displays the lowest and highest contribution this week and the width of the graph displays in what area the contribution was mainly this week. This graph only displays members who have contribution data collected.",
                                    data: {
                                        type: 'violin',
                                        data: {
                                            labels: ["Contribution this week"],
                                            datasets: members.map(member => {
                                                const dataset = {
                                                    label: member.airline.name,
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
                                    id: new ObjectId(),
                                    type: "Bar graph",
                                    description: "Bar graph comparing the percentage of the member's alliance's total contribution.",
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
                            const select = new MessageSelectMenu({ 
                                customId: "chart", 
                                placeholder: "Select a graph...",
                                maxValues: 1,
                                minValues: 1,
                                options: graphs.map((graph, index) => ({
                                    label: graph.data.options.title.text,
                                    description: graph.type,
                                    value: graph.id.toHexString(),
                                    default: !index
                                }))
                            });
                            const chart = new QuickChart()
                            .setConfig(graphs[0].data)
                            .setBackgroundColor("transparent");
                            const embed = new MessageEmbed({
                                color: 15105570,
                                title: "Member comparing",
                                description: graphs[0].description,
                                image: {
                                    url: await chart.getShortUrl()
                                },
                                footer: {
                                    text: `Requests remaining: ${requestsRemaining.toLocaleString(locale)}`,
                                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                                }
                            });
                            const row = new MessageActionRow({ components: [select] });
                            const message = await interaction.editReply({ 
                                embeds: [embed], 
                                components: [row] 
                            }) as Message;
                            const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
                            const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
                            collector.on("collect", async interaction => {
                                if (interaction.isSelectMenu()) {
                                    const value = interaction.values[0];
                                    const graph = graphs.find(graph => graph.id.equals(value));
                                    embed.setDescription(graph.description);
                                    const chart = new QuickChart()
                                    .setConfig(graph.data)
                                    .setBackgroundColor("transparent");
                                    const url = await chart.getShortUrl();
                                    for (const option of select.options) option.default = (value === option.value);
                                    row.setComponents(select);
                                    await interaction.update({ 
                                        embeds: [embed.setImage(url)],
                                        components: [row]
                                    });
                                }
                            });
                            collector.once("end", async collected => {
                                row.setComponents(select.setDisabled(true));
                                const reply = collected.last() || interaction;
                                await reply.editReply({ components: [row] }).catch(() => void 0);
                            });
                            break;
                        }
                    }
                    break;
                }
            }
        }
        catch(error) {
            if (error instanceof DiscordClientError) {
                await error.send(interaction);
            } else {
                console.error(`Error while executing /${interaction.commandName}`, error);
                await DiscordClientError.sendUnknownError(interaction);
            }
        }
    }
}

export = command;