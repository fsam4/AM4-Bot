import { MessageEmbed, MessageActionRow, MessageSelectMenu, Formatters, Constants, type Message, type MessageComponentInteraction, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';
import { User } from '../../utils';
import Airline from '../../../src/classes/airline';

import differenceInDays from 'date-fns/differenceInDays';
import format from 'date-fns/format';

import type { AM4_Data, Settings, Discord } from '@typings/database';
import type { ContextMenu } from '../types';

type AllianceMember = AM4_Data.member & { left: Date, alliance: AM4_Data.alliance };

const command: ContextMenu<UserContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isAdministrator: false,
    isPublic: true,
    data: {
        name: "Get Airline",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { rest, database, locale }) {
        await interaction.deferReply();
        const users = database.discord.collection<Discord.user>("Users");
        const settings = database.settings.collection<Settings.user>('Users');
        const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
        const memberCollection = database.am4.collection<AM4_Data.member & { left: Date }>('Members');
        const planeSettings = database.settings.collection<Settings.plane>('Planes');
        try {
            const targetAccount = await users.findOne({ id: interaction.targetId });
            if (!targetAccount?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const { status, airline, fleet, ipo, awards } = await rest.fetchAirline(targetAccount.airlineID);
            if (!status.success) throw new DiscordClientError(status.error);
            const { training, options, salaries } = new User(interaction.user.id, await settings.findOne({ id: interaction.user.id }));
            const planes = await planeCollection.aggregate<AM4_Data.plane & { amount: number }>([
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
                plane.fuel *= (100 - training.fuel) / 100;
                plane.co2 *= (100 - training.co2) / 100;
            }

            type GameMode = Lowercase<typeof airline.gameMode>;
            const profitOptions = {
                fuel_price: options.fuel_price,
                co2_price: options.co2_price,
                activity: options.activity,
                mode: <GameMode>airline.gameMode.toLowerCase(),
                reputation: airline.reputation,
                salaries: salaries
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
            const statistics = {
                fuelUsage: planes.length ? planes.map(plane => plane.fuel * (options.activity * plane.speed) * plane.amount).reduce((a, b) => a + b) : 0,
                co2Usage: planes.length ? planes.map(plane => plane.co2 * (options.activity * plane.speed) * (plane.type === "cargo" ? (plane.capacity / 500) : plane.capacity) * plane.amount).reduce((a, b) => a + b) : 0,
                A_check: planes.length ? planes.map(plane => plane.A_check.price / plane.A_check.time * options.activity * plane.amount).reduce((a, b) => a + b) : 0,
                capacity: {
                    pax: aircrafts.pax.length ? aircrafts.pax.concat(aircrafts.vip).map(plane => plane.capacity * plane.amount).reduce((a, b) => a + b) : 0,
                    cargo: aircrafts.cargo.length ? aircrafts.cargo.map(plane => plane.capacity * plane.amount).reduce((a, b) => a + b) : 0
                },
                size: {
                    pax: aircrafts.pax.length ? aircrafts.pax.map(plane => plane.amount).reduce((a, b) => a + b) : 0,
                    cargo: aircrafts.cargo.length ? aircrafts.cargo.map(plane => plane.amount).reduce((a, b) => a + b) : 0,
                    vip: aircrafts.vip.length ? aircrafts.vip.map(plane => plane.amount).reduce((a, b) => a + b) : 0
                }
            };

            const embeds = [
                new MessageEmbed({
                    color: "BLURPLE",
                    timestamp: airline.founded,
                    author: {
                        name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '🟢': '🔴'}`,
                        url: airline.displayLogoURL,
                        iconURL: airline.displayLogoURL
                    },
                    description: `**Airline ID:** ${targetAccount.airlineID}`,
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
                            value: `**Per hour:** $${Math.round(res.airline.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${res.airline.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(res.airline.profit * 7).toLocaleString(locale)}`
                        }
                    ]
                }),
                new MessageEmbed({
                    color: "BLURPLE",
                    timestamp: airline.founded,
                    author: {
                        name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '🟢': '🔴'}`,
                        iconURL: airline.displayLogoURL,
                        url: airline.displayLogoURL,
                    },
                    description: `**Airline ID:** ${targetAccount.airlineID}`,
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
                    value: `**Share value:** $${ipo.current.toLocaleString(locale)}\n**Company value:** $${Math.round(ipo.current * ipo.shares.total).toLocaleString(locale)}\n**Shares available:** ${ipo.shares.available.toLocaleString(locale)}/${ipo.shares.total.toLocaleString(locale)}\n**Estimated growth:** $${estimatedGrowth.toFixed(2)}/day`,
                    inline: false
                }, field);
                const sv = ipo.growth.reverse();
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
                        },
                    },
                }).setBackgroundColor('transparent');
                const url = await history.getShortUrl();
                embeds[0].setImage(url);
            }
            if (awards.length) embeds[0].addFields({
                name: Formatters.bold(Formatters.underscore("Awards")),
                value: Formatters.codeBlock(awards.map(award => `${award.name} • ${format(award.date, 'dd/MM/yyyy')}`).join('\n'))
            });
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
                        },
                    },
                    title: {
                        display: true,
                        position: 'left',
                        text: 'Profit per plane type',
                        fontFamily: 'Serif',
                        fontColor: 'white',
                    },
                },
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
                                    input: '$sv',
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
                    emoji: "📅",
                    description: "Alliance history log"
                });
                const embed = new MessageEmbed({
                    color: "BLURPLE",
                    timestamp: airline.founded,
                    author: {
                        name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '🟢': '🔴'}`,
                        url: airline.displayLogoURL,
                        iconURL: airline.displayLogoURL
                    },
                    description: `**Airline ID:** ${targetAccount.airlineID}`,
                    footer: {
                        text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                        iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                    },
                    fields: alliances.map(member => {
                        const days = Math.abs(differenceInDays(new Date(member.joined), new Date(member.left)));
                        return {
                            name: Formatters.underscore(Formatters.bold(member.alliance.name)),
                            value: `**Joined:** ${Formatters.time(member.joined)}${(airline.alliance && member.alliance.name === airline.alliance.name) ? `\n` : `\n**Left:** ${Formatters.time(member.left, "D")}\n`}**Contribution:** $${member.contribution.toLocaleString(locale)}\n**Flights:** ${member.flights.toLocaleString(locale)}\n**Avg/day:** $${Math.round(days > 0 ? (member.contribution / days) : member.contribution).toLocaleString(locale)}`,
                            inline: false
                        }
                    })
                });
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
            }) as Message;
            const filter = ({ user }: MessageComponentInteraction) => user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ filter, idle: 10 * 60 * 1000 });
            collector.on("collect", async interaction => {
                if (interaction.isSelectMenu()) {
                    let embed: MessageEmbed;
                    await interaction.deferUpdate();
                    const [value] = interaction.values;
                    for (const option of select.options) option.default = option.value === value;
                    const index = select.options.findIndex(option => option.value === value);
                    embed = embeds[index];
                    row.setComponents(select);
                    await interaction.editReply({
                        embeds: [embed],
                        components: [row]
                    });
                }
            });
            collector.once("end", async collected => {
                row.setComponents(select.setDisabled(true));
                const reply = collected.last() || interaction;
                await reply.editReply({ components: [row] }).catch(() => undefined);
            });
        }
        catch(error) {
            if (error instanceof DiscordClientError) {
                await error.send(interaction);
            } else {
                console.error(`Error while executing ${interaction.commandName}`, error);
                await DiscordClientError.sendUnknownError(interaction);
            }
        }
    }
}

export = command;