import { MessageEmbed, Permissions, MessageActionRow, MessageSelectMenu, MessageAttachment, Formatters, Constants } from 'discord.js';
import { Discord as Utils } from '../../utils';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';
import Airline from '../../../src/classes/airline';
import Plane from '../../../src/lib/plane';

import differenceInDays from 'date-fns/differenceInDays';
import compareAsc from 'date-fns/compareAsc';
import addMonths from 'date-fns/addMonths';
import subMonths from 'date-fns/subMonths';
import format from 'date-fns/format';

import type { AM4, Settings } from '@typings/database';
import type { SlashCommand } from '@discord/types';

type AllianceMember = AM4.AllianceMember & { left: Date, alliance: AM4.Alliance };
type Aircraft = AM4.Plane & { amount?: number };

const { createAttachmentUrl, isCachedCommandInteraction } = Utils;

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
        name: 'airline',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Search and compare airlines and their fleets',
        defaultPermission: true,
        options: [
            {
                name: 'compare',
                description: 'Compare airlines with graphs',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'airline_1',
                        description: 'The username or ID of the airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'airline_2',
                        description: 'The username or ID of the airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'airline_3',
                        description: 'The username or ID of the airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'airline_4',
                        description: 'The username or ID of the airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    },
                    {
                        name: 'airline_5',
                        description: 'The username or ID of the airline',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: 'search',
                description: 'Search for an airline. Leave all arguments empty to see your own airline.',
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
                name: 'fleet',
                description: "Search for an airline's fleet. Leave all arguments empty to see your own airline.",
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
            }
        ]
    },
    async execute(interaction, { database, rest, account, ephemeral, locale }) {
        await interaction.deferReply({ ephemeral });
        try {
            const userCollection = database.settings.collection<Settings.User>('Users');
            const planeCollection = database.am4.collection<AM4.Plane>('Planes');
            const memberCollection = database.am4.collection<AM4.AllianceMember>('Members');
            const planeSettings = database.settings.collection<Settings.Plane>('Planes');
            const user = await userCollection.findOne({ id: interaction.user.id });
            const subCommand = interaction.options.getSubcommand();
            switch(subCommand) {
                case "search": {
                    const input = interaction.options.getInteger("id") || interaction.options.getString("name");
                    if (!input && !account?.airlineID) throw new DiscordClientError("You need define at least one of the arguments or login with `/user login` to see your own airline!");
                    const { status, airline, fleet, ipo, awards } = await rest.fetchAirline(input || account.airlineID);
                    if (!status.success) throw new DiscordClientError(status.error);
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
        
                    const planeOptions = await planeSettings.find({ id: interaction.user.id }).toArray();
                    for (const plane of planes) {
                        const options = planeOptions.find(({ planeID }) => plane._id.equals(planeID));
                        if (options) {
                            const { modifications, engine: engineName } = options;
                            if (engineName) {
                                const engine = plane.engines.find(engine => engine.name === engineName);
                                plane.speed = engine.speed;
                                plane.fuel = engine.fuel;
                            }
                            if (modifications.fuel) plane.fuel *= 0.9;
                            if (modifications.speed) plane.speed *= 1.1;
                            if (modifications.co2) plane.co2 *= 0.9;
                        }
                        if (user?.training.fuel) plane.fuel *= (100 - user.training.fuel) / 100;
                        if (user?.training.co2) plane.co2 *= (100 - user.training.co2) / 100;
                    }
        
                    const profitOptions = {
                        fuel_price: user?.options.fuel_price,
                        co2_price: user?.options.co2_price,
                        activity: user?.options.activity,
                        gameMode: airline.gameMode,
                        reputation: airline.reputation,
                        salaries: user?.salaries
                    };

                    const res = Airline.profit(planes, profitOptions);
        
                    const select = new MessageSelectMenu({
                        customId: "airlineSelect",
                        placeholder: "Select display...",
                        options: [
                            {
                                label: "Airline",
                                value: "airline",
                                emoji: emojis.plane,
                                description: "General airline statistics",
                                default: true
                            },
                            {
                                label: "Fleet",
                                value: "fleet",
                                emoji: emojis.fleet,
                                description: "General fleet statistics",
                                default: false
                            }
                        ]
                    });
        
                    const staff = Airline.calculateStaff(planes);
                    const aircrafts = {
                        pax: planes.filter(plane => plane.type === "pax"),
                        cargo: planes.filter(plane => plane.type === "cargo"),
                        vip: planes.filter(plane => plane.type === "vip")
                    };
                    const activity = user?.options.activity ?? 18;
                    const statistics = {
                        fuelUsage: planes.length && planes.map(plane => plane.fuel * (activity * plane.speed) * plane.amount).reduce((a, b) => a + b),
                        co2Usage: planes.length && planes.map(plane => plane.co2 * (activity * plane.speed) * (plane.type === "cargo" ? (plane.capacity / 500) : plane.capacity) * plane.amount).reduce((a, b) => a + b),
                        A_check: planes.length && planes.map(plane => plane.A_check.price / plane.A_check.time * activity * plane.amount).reduce((a, b) => a + b),
                        capacity: {
                            pax: aircrafts.pax.length && aircrafts.pax.concat(aircrafts.vip).map(plane => plane.capacity * plane.amount).reduce((a, b) => a + b),
                            cargo: aircrafts.cargo.length && aircrafts.cargo.map(plane => plane.capacity * plane.amount).reduce((a, b) => a + b)
                        },
                        size: {
                            pax: aircrafts.pax.length && aircrafts.pax.map(plane => plane.amount).reduce((a, b) => a + b),
                            cargo: aircrafts.cargo.length && aircrafts.cargo.map(plane => plane.amount).reduce((a, b) => a + b),
                            vip: aircrafts.vip.length && aircrafts.vip.map(plane => plane.amount).reduce((a, b) => a + b)
                        }
                    };
        
                    const embeds = [
                        new MessageEmbed({
                            color: "BLURPLE",
                            timestamp: airline.founded,
                            author: {
                                name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '????': '????'}`,
                                url: airline.displayLogoURL,
                                iconURL: airline.displayLogoURL
                            },
                            footer: {
                                text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                                iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                            },
                            fields: [
                                {
                                    name: Formatters.bold(Formatters.underscore("Airline info")),
                                    value: `**Rank:** ${airline.rank.toLocaleString(locale)} in ${airline.gameMode}\n**Founded:** ${Formatters.time(airline.founded)}\n**Pax reputation:** ${airline.reputation.pax}%${planes.some(plane => plane.type === 'cargo') ? `\n**Cargo reputation:** ${airline.reputation.cargo}%` : ``}\n**Achievements:** ${airline.achievements.toLocaleString(locale)} completed\n**Fleet:** ${fleet.size.toLocaleString(locale)} planes\n**Routes:** ${fleet.routes.toLocaleString(locale)}\n**Level:** ${airline.level.toLocaleString(locale)}`,
                                    inline: false
                                },
                                {
                                    name: Formatters.bold(Formatters.underscore("Profitability")),
                                    value: `**Per hour:** $${Math.round(res.airline.profit / activity).toLocaleString(locale)}\n**Per day:** $${res.airline.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(res.airline.profit * 7).toLocaleString(locale)}`
                                }
                            ]
                        }),
                        new MessageEmbed({
                            color: "BLURPLE",
                            timestamp: airline.founded,
                            author: {
                                name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '????': '????'}`,
                                iconURL: airline.displayLogoURL,
                                url: airline.displayLogoURL,
                            },
                            footer: {
                                text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                                iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                            },
                            fields: [
                                {
                                    name: Formatters.bold(Formatters.underscore("Fleet info")),
                                    value: `**Total size:** ${fleet.size.toLocaleString(locale)} planes\n**Pax fleet:** ${statistics.size.pax.toLocaleString(locale)} planes\n**Cargo fleet:** ${statistics.size.cargo.toLocaleString(locale)} planes\n**VIP fleet:** ${statistics.size.vip.toLocaleString(locale)} planes\n**Routes:** ${fleet.routes.toLocaleString(locale)}`,
                                    inline: true
                                },
                                {
                                    name: Formatters.bold(Formatters.underscore("Airline staff")),
                                    value: `${Formatters.formatEmoji(emojis.pilots)} ${staff.pilots.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.crew)} ${staff.crew.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.engineer)} ${staff.engineers.toLocaleString(locale)}\n${Formatters.formatEmoji(emojis.tech)} ${staff.tech.toLocaleString(locale)}`,
                                    inline: true
                                },
                                {
                                    name: Formatters.bold(Formatters.underscore("Statistics")),
                                    value: `**Fuel/day:** ${Math.round(statistics.fuelUsage).toLocaleString(locale)} lbs\n**Co2/day:** ${Math.round(statistics.co2Usage).toLocaleString(locale)} quotas\n**A-check/day:** $${Math.round(statistics.A_check).toLocaleString(locale)}\n**Total pax capacity:** ${statistics.capacity.pax.toLocaleString(locale)}\n**Total cargo capacity:** ${statistics.capacity.cargo.toLocaleString(locale)} lbs`,
                                    inline: false
                                }
                            ]
                        })
                    ];
                    if (ipo.has) {  
                        const field = embeds[0].fields.pop();
                        const estimatedGrowth = Airline.estimatedShareValueGrowth(planes, profitOptions);
                        embeds[0].addFields({
                            name: Formatters.bold(Formatters.underscore("Share Value")),
                            value: `**Share value:** $${ipo.currentValue.toLocaleString(locale)}\n**Company value:** $${Math.round(ipo.currentValue * ipo.shares.total).toLocaleString(locale)}\n**Shares available:** ${ipo.shares.available.toLocaleString(locale)}/${ipo.shares.total.toLocaleString(locale)}\n**Estimated growth:** $${estimatedGrowth.toFixed(2)}/day`,
                            inline: false
                        }, field);
                        const sv = ipo.growth.reverse();
                        const history = new QuickChart()                     
                        .setConfig({
                            type: 'line',
                            data: {
                                datasets: [
                                    {
                                        label: "Share Value",
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
                                                parser: "DD/MM/YYYY HH:mm",
                                                displayFormats: {
                                                    day: "DD/MM - HH:mm",
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
                        }).setBackgroundColor('transparent');
                        const url = await history.getShortUrl();
                        embeds[0].setImage(url);
                    }
                    if (awards.length) {
                        embeds[0].addFields({
                            name: Formatters.bold(Formatters.underscore("Awards")),
                            value: Formatters.codeBlock(awards.map(award => `${award.name} ??? ${format(award.date, 'dd/MM/yyyy')}`).join('\n'))
                        });
                    }
                    if (isCachedCommandInteraction(interaction)) {
                        const chart = new QuickChart()
                        .setConfig({
                            type: 'pie',
                            data: {
                                labels: res.fleet.map(plane => `${plane.name} (${plane.amount}x)`),
                                datasets: [{ data: res.fleet.map(plane => plane.profit < 0 ? 0 : plane.profit) }]
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
                                        display: planes.length < 10,
                                        align: 'center',
                                        backgroundColor: 'white',
                                        borderColor: "black",
                                        borderWidth: 1,
                                        borderRadius: 3,
                                        font: {
                                            color: 'black'
                                        },
                                        formatter: (value: number) => {
                                            let s = value < 1000000000 
                                            ? (value / 1000000).toFixed(1) + 'm' 
                                            : (value / 1000000000).toFixed(1) + 'b'
                                            return '$' + s;
                                        }
                                    }
                                },
                                title: {
                                    display: true,
                                    position: 'left',
                                    text: 'Profit per plane type',
                                    fontFamily: 'Serif',
                                    fontColor: 'white',
                                }
                            }
                        }).setBackgroundColor('transparent');
                        embeds[1].setImage(await chart.getShortUrl());
    
                        const alliances = await memberCollection.aggregate<AllianceMember>([
                            {
                                $match: {
                                    name: airline.name
                                }
                            },
                            {
                                $sort: {
                                    expire: 1
                                }
                            },
                            {
                                $limit: 5
                            },
                            {
                                $lookup: {
                                    from: "Alliances",
                                    localField: "allianceID",
                                    foreignField: "_id",
                                    as: "alliance"
                                }
                            },
                            {
                                $unwind: "$alliance"
                            },
                            {
                                $addFields: {
                                    left: {
                                        $last: {
                                            $map: {
                                                input: '$shareValue',
                                                as: 'object',
                                                in: '$$object.date'
                                            }
                                        }
                                    }
                                }
                            }
                        ]).toArray();
                        if (alliances.length) {
                            select.addOptions({
                                label: "Alliance log",
                                value: "member",
                                emoji: "????",
                                description: "Alliance history log"
                            });
                            const embed = new MessageEmbed({
                                color: "BLURPLE",
                                timestamp: airline.founded,
                                author: {
                                    name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '????': '????'}`,
                                    url: airline.displayLogoURL,
                                    iconURL: airline.displayLogoURL
                                },
                                footer: {
                                    text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                                },
                                fields: alliances.map(member => {
                                    const days = Math.abs(differenceInDays(new Date(member.joined), new Date(member.left)));
                                    return {
                                        name: Formatters.underscore(member.alliance.name),
                                        value: `**Joined:** ${Formatters.time(member.joined)}${(airline.alliance && member.alliance.name === airline.alliance.name) ? `\n` : `\n**Left:** ${Formatters.time(member.left, "D")}\n`}**Contribution:** $${member.contribution.toLocaleString(locale)}\n**Flights:** ${member.flights.toLocaleString(locale)}\n**Avg/day:** $${Math.round(days > 0 ? (member.contribution / days) : member.contribution).toLocaleString(locale)}`,
                                        inline: false
                                    }
                                })
                            });
                            const dates = alliances.flatMap(member => member.offline.map(({ date }) => date));
                            const [oldestDate] = dates.sort(compareAsc);
                            const activity = new QuickChart()
                            .setConfig({
                                type: 'bar',
                                data: {
                                    datasets: alliances.map(member => ({
                                        label: member.alliance.name,
                                        data: member.offline.map(({ date, value }) => ({
                                            x: date,
                                            y: value
                                        }))
                                    }))
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
                                        text: 'Offline History',
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
                                                    min: 0,
                                                    max: 31,
                                                    maxTicksLimit: 12,
                                                    stepSize: 1,
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
                                                    unit: "month",
                                                    displayFormats: {
                                                        month: "MMMM YYYY"
                                                    }
                                                },
                                                ticks: {
                                                    maxTicksLimit: 12,
                                                    fontFamily: 'Serif',
                                                    fontColor: 'white',
                                                    min: subMonths(oldestDate || interaction.createdAt, 1),
                                                    max: addMonths(interaction.createdAt, 1)
                                                }
                                            }
                                        ]
                                    }
                                }
                            })
                            .setBackgroundColor('transparent');
                            embed.setImage(await activity.getShortUrl());
                            embeds.push(embed);
                        }
                        const row = new MessageActionRow({ components: [select] });
                        let [embed] = embeds;
                        const message = await interaction.editReply({
                            embeds: [embed],
                            components: [row]
                        });
                        const collector = message.createMessageComponentCollector({ 
                            filter: ({ user }) => user.id === interaction.user.id, 
                            idle: 10 * 60 * 1000, 
                            componentType: "SELECT_MENU" 
                        });
                        collector.on("collect", async interaction => {
                            let embed: MessageEmbed;
                            await interaction.deferUpdate();
                            const [value] = interaction.values;
                            for (const option of select.options) option.default = option.value === value;
                            const index = select.options.findIndex(option => option.value === value);
                            embed = embeds[index];
                            row.components[0] = select;
                            await interaction.editReply({
                                embeds: [embed],
                                components: [row]
                            });
                        });
                        collector.once("end", async collected => {
                            select.setDisabled(true);
                            row.components[0] = select;
                            const reply = collected.last() || interaction;
                            await reply.editReply({ components: [row] }).catch(() => void 0);
                        });
                    } else {
                        await interaction.editReply({ embeds });
                    }
                    break;
                }
                case "fleet": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const input = interaction.options.getInteger("id") || interaction.options.getString("name");
                    if (!input && !account?.airlineID) throw new DiscordClientError("You need define at least one of the arguments or login with `/user login` to see your own airline!");
                    const { status, airline, fleet } = await rest.fetchAirline(input || account.airlineID);
                    if (!status.success) throw new DiscordClientError(status.error);
                    if (!fleet.size) throw new DiscordClientError("This airline does not have any planes in it's fleet...");
                    const planes = await planeCollection.aggregate<Aircraft>([
                        {
                            $match: { 
                                name: { 
                                    $in: fleet.planes.map(plane => plane.name) 
                                } 
                            }
                        },
                        {
                            $limit: 25
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
                    if (!planes.length) throw new DiscordClientError("This airline does not have any planes in it's fleet...");
                    const planeOptions = await planeSettings.find({ id: interaction.user.id }).toArray();
                    for (const plane of planes) {
                        const options = planeOptions.find(({ planeID }) => plane._id.equals(planeID));
                        if (options) {
                            const { modifications, engine: engineName } = options;
                            if (engineName) {
                                const engine = plane.engines.find(engine => engine.name === engineName);
                                plane.speed = engine.speed;
                                plane.fuel = engine.fuel;
                            }
                            if (modifications.fuel) plane.fuel *= 0.9;
                            if (modifications.speed) plane.speed *= 1.1;
                            if (modifications.co2) plane.co2 *= 0.9;
                        }
                        if (user?.training.fuel) plane.fuel *= (100 - user.training.fuel) / 100;
                        if (user?.training.co2) plane.co2 *= (100 - user.training.co2) / 100;
                    }
                    const select = new MessageSelectMenu({
                        customId: "plane",
                        placeholder: "Select an aircraft...",
                        options: planes.map(plane => ({
                            label: plane.name,
                            value: plane._id.toHexString(),
                            description: `${plane.amount} planes`,
                            emoji: emojis[plane.type]
                        }))
                    });
                    let plane = planes[0];
                    let image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                    const options = {
                        activity: user?.options.activity ?? 18,
                        fuelPrice: user?.options.fuel_price,
                        co2Price: user?.options.co2_price,
                        reputation: airline.reputation[plane.type],
                        gameMode: airline.gameMode
                    };
                    let statistics = {
                        profit: Plane.profit(plane, options).profit,
                        sv: Plane.estimatedShareValueGrowth(plane, options)
                    };
                    const embed = new MessageEmbed({
                        color: "BLURPLE",
                        timestamp: airline.founded,
                        description: `**Amount:** ${plane.amount} planes\n**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`,
                        image: {
                            url: createAttachmentUrl(image)
                        },
                        author: {
                            name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '????': '????'}`,
                            iconURL: airline.displayLogoURL,
                            url: airline.displayLogoURL
                        },
                        footer: {
                            text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        },
                        fields: [
                            { 
                                name: Formatters.bold(Formatters.underscore("General statistics")), 
                                value: `**Speed:** ${Math.round(airline.gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                inline: true 
                            },
                            { 
                                name: '\u200B', 
                                value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(airline.gameMode === "Easy" ? plane.A_check.price / 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time.toLocaleString(locale)}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                inline: true 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Profitability")), 
                                value: `**Per hour:** $${Math.round(statistics.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${statistics.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(statistics.profit * 7).toLocaleString(locale)}\n**Share value:** $${statistics.sv.toFixed(2)}/day`, 
                                inline: false 
                            }
                        ]
                    });
                    if (plane.price) {
                        const profitability = Math.round(plane.price / statistics.profit);
                        embed.fields.last().value += `\n**Profitability:** ${profitability > 0 ? `in ${profitability.toLocaleString(locale)} days` : 'never' }`;
                    }
                    select.options[0].default = true;
                    const row = new MessageActionRow({ components: [select] });
                    const message = await interaction.editReply({
                        embeds: [embed],
                        files: [image],
                        components: [row]
                    });
                    const collector = message.createMessageComponentCollector({
                        filter: ({ user }) => user.id === interaction.user.id, 
                        idle: 10 * 60 * 1000, 
                        componentType: "SELECT_MENU"
                    });
                    collector.on("collect", async interaction => {
                        const [planeId] = interaction.values;
                        plane = planes.find(plane => plane._id.equals(planeId));
                        image = new MessageAttachment(plane.image.buffer, "plane.jpg");
                        options.reputation = airline.reputation[plane.type];
                        statistics = {
                            profit: Plane.profit(plane, options).profit,
                            sv: Plane.estimatedShareValueGrowth(plane, options)
                        };
                        embed.setDescription(`**Amount:** ${plane.amount} planes\n**Plane type:** ${plane.type === "vip" ? plane.type.toUpperCase() : plane.type}`);
                        embed.setImage(createAttachmentUrl(image));
                        embed.setFields([
                            { 
                                name: Formatters.bold(Formatters.underscore("General statistics")), 
                                value: `**Speed:** ${Math.round(airline.gameMode === "Easy" ? plane.speed * 1.5 : plane.speed).toLocaleString(locale)} km/h\n**Fuel usage:** ${plane.fuel.toFixed(2)} lbs/km\n**Co2 usage:** ${plane.co2.toFixed(2)} kg/${plane.type === "cargo" ? "1k": "pax"}/km\n**Runway:** ${plane.runway.toLocaleString(locale)} ft\n**Range:** ${plane.range.toLocaleString(locale)} km\n**Capacity:** ${plane.capacity.toLocaleString(locale)} ${plane.type === "cargo" ? "lbs" : "seats"}`, 
                                inline: true 
                            },
                            { 
                                name: '\u200B', 
                                value: `**Price:** ${plane.price ? `$${plane.price.toLocaleString(locale)}` : `${plane.bonus_points.toLocaleString(locale)} ${Formatters.formatEmoji(emojis.points)}`}\n**A-check:** $${Math.round(airline.gameMode === "Realism" ? plane.A_check.price * 2 : plane.A_check.price).toLocaleString(locale)}/${plane.A_check.time}h\n**Pilots:** ${plane.staff.pilots.toLocaleString(locale)} persons\n**Crew:** ${plane.staff.crew.toLocaleString(locale)} persons\n**Engineers:** ${plane.staff.engineers.toLocaleString(locale)} persons\n**Tech:** ${plane.staff.tech.toLocaleString(locale)} persons`, 
                                inline: true 
                            },
                            { 
                                name: Formatters.bold(Formatters.underscore("Profitability")), 
                                value: `**Per hour:** $${Math.round(statistics.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${statistics.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(statistics.profit * 7).toLocaleString(locale)}\n**Share value:** $${statistics.sv.toFixed(2)}/day`, 
                                inline: false 
                            }
                        ]);
                        if (plane.price) {
                            const profitability = Math.round(plane.price / statistics.profit);
                            embed.fields.last().value += `\n**Profitability:** ${profitability > 0 ? `in ${profitability.toLocaleString(locale)} days` : 'never' }`;
                        }
                        for (const option of select.options) option.default = plane._id.equals(option.value);
                        await interaction.message.removeAttachments();
                        row.setComponents(select);
                        await interaction.update({
                            embeds: [embed],
                            files: [image],
                            components: [row]
                        });
                    });
                    collector.on("end", async collected => {
                        row.setComponents(select.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(() => void 0);
                    });
                    if (fleet.planes.length > 25) await interaction.followUp({
                        content: `Due to the amount of different plane models of this airline's fleet the bot will only display 25 out of ${fleet.size} planes.`,
                        ephemeral: true
                    });
                    break;
                }
                case "compare": {
                    if (!isCachedCommandInteraction(interaction)) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const planes = await planeCollection.find().toArray();
                    const options = interaction.options.data[0].options.filter(option => option.name.startsWith("airline"));
                    const airlines = await Promise.all(
                        options.map(async option => {
                            const response = await rest.fetchAirline(Number(option.value) || <string>option.value);
                            if (!response.status.success) throw new DiscordClientError(`${Formatters.bold(`${option.name}:`)} ${response.status.error}`);
                            response.fleet.planes = planes.filter(plane => response.fleet.planes.some(({ name }) => name === plane.name)).map(plane => {
                                const amount = response.fleet.planes.find(({ name }) => name === plane.name).amount;
                                return { ...plane, amount };
                            });
                            return response;
                        })
                    );
                    const graphs = [
                        {
                            id: new ObjectId(),
                            type: "Scatter graph",
                            description: "A scatter graph comparing the fleet size to fleet profit. The x-axis displays the fleet profit as a logarithmic scale. This means that for example 5e+7 is 5??10^7. The `+7` or `-7` part is the exponent and the first part `5e` is 5 multiplied by 10. The profit calculations are made with default settings and 100% reputation to make the results comparable.",
                            data: {
                                type: 'scatter',
                                data: {
                                    datasets: airlines.map(({ airline, fleet }) => ({
                                        label: airline.name,
                                        data: [
                                            {
                                                x: Airline.profit(<Aircraft[]>fleet.planes, { 
                                                    gameMode: airline.gameMode,
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
                                        text: 'Profit to fleet size',
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
                            id: new ObjectId(),
                            type: "Radar graph",
                            description: "Radar graph comparing general statistics of the airline. The wider the covered area is the better the general statistics are overall.",
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
                            id: new ObjectId(),
                            type: "Line graph",
                            description: "Line graph comparing airline IPO growth history.",
                            data: {
                                type: 'line',
                                data: {
                                    datasets: airlines.map(({ ipo, airline }) => ({
                                        fill: false,
                                        hidden: !ipo.has,
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
                            id: new ObjectId(),
                            type: "Stacked bar graph",
                            description: "A stacked bar graph comparing the profit, income and expenses of the airlines. The total bar heigth represents the total income of the airline. The red area of the bar represents how much of it goes to expenses and the green area represents the final profit. The calculations are made with default settings and 100% reputation to make the results comparable.",
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
                                                    gameMode: airline.gameMode,
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
                                                    gameMode: airline.gameMode,
                                                    reputation: {
                                                        pax: 100,
                                                        cargo: 100
                                                    }
                                                }).airline.expenses;
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
                        title: "Airline comparing",
                        description: graphs[0].description,
                        image: {
                            url: await chart.getShortUrl()
                        },
                        footer: {
                            text: `Requests remaining: ${airlines.last().status.requestsRemaining.toLocaleString(locale)}`,
                            iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                        }
                    });
                    const row = new MessageActionRow({ components: [select] });
                    const message = await interaction.editReply({ 
                        embeds: [embed], 
                        components: [row] 
                    })
                    const collector = message.createMessageComponentCollector({ 
                        filter: ({ user }) => user.id === interaction.user.id, 
                        idle: 10 * 60 * 1000,
                        componentType: "SELECT_MENU" 
                    });
                    collector.on("collect", async interaction => {
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
                    });
                    collector.once("end", async collected => {
                        row.setComponents(select.setDisabled(true));
                        const reply = collected.last() || interaction;
                        await reply.editReply({ components: [row] }).catch(() => void 0);
                    });
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