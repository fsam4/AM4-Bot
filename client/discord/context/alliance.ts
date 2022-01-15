import { MessageEmbed, MessageSelectMenu, Formatters, MessageActionRow, Constants, type Message, type MessageComponentInteraction, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import compareAsc from 'date-fns/compareAsc';
import addDays from 'date-fns/addDays';

import type { AM4_Data, Discord } from '@typings/database';
import type { ContextMenu } from '../types';

interface AllianceMember extends AM4_Data.member {
    daysOffline: number;
    thisWeek: number;
    left: Date;
}

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
        name: "Get Alliance",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { database, rest, locale }) {
        await interaction.deferReply();
        const allainceCollection = database.am4.collection<AM4_Data.alliance>('Alliances');
        const memberCollection = database.am4.collection<AM4_Data.member>('Members');
        const users = database.discord.collection<Discord.user>("Users");
        try {
            const account = await users.findOne({ id: interaction.targetId });
            if (!account?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const { status: airlineStatus, airline } = await rest.fetchAirline(account.airlineID);
            if (!airlineStatus.success) throw new DiscordClientError(airlineStatus.error);
            if (!airline.alliance) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} does not seem to be in an alliance...`);
            const { alliance, members, status } = await airline.alliance.fetch();
            if (!status.success) throw new DiscordClientError(status.error);
            const recently_joined = members.sort((a, b) => compareAsc(b.joined, a.joined)).toArray().slice(0, 5);
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
                                value: Formatters.codeBlock(recently_joined.map(member => `${member.airline.name} (${formatDistanceToNowStrict(member.joined, { addSuffix: true, unit: 'day' })})`).join('\n')),
                                inline: true
                            }
                        ]
                    });
                    if (alliance.inSeason) embed.fields[0].value += `\n**Season contribution:** $${alliance.contribution.season.toLocaleString(locale)}`;
                    const allianceDocument = await allainceCollection.findOne({ name: alliance.name });
                    if (allianceDocument) {
                        const member_list = await memberCollection.aggregate<AllianceMember>([
                            {
                                $match: {
                                    alliance: alliance.name
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
                        const recently_left = member_list.filter(member => member.left).sort((a, b) => compareAsc(b.left, a.left)).slice(0, 5);
                        if (recently_left.length) embed.addFields({
                            name: Formatters.bold(Formatters.underscore("Recently left")),
                            value: Formatters.codeBlock(recently_left.map(member => `${member.name} (${formatDistanceToNowStrict(member.left, { addSuffix: true, unit: 'day' })})`).join('\n')),
                            inline: true
                        });
                        const growth = allianceDocument.values.map(({ value }) => value).difference();
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
                                }
                            },
                            {
                                emoji: "836889801801072640",
                                data: {
                                    type: 'line',
                                    data: {
                                        datasets: member_list.filter(member => !member.left).map(member => ({
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
                                                        fontSize: 13
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        ];
                        if (allianceDocument.values.length === 7) charts.push({
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
                                            data: Array(growth.length).fill(null).map((_, i) => {
                                                const value = Math.min(...growth);
                                                return {
                                                    x: addDays(interaction.createdAt, i + 1),
                                                    y: alliance.value + value * (i + 1)
                                                }
                                            })
                                        },
                                        {
                                            label: 'Estimated',
                                            borderDash: [5, 5],
                                            backgroundColor: 'rgb(25, 208, 231)',
                                            borderColor: 'rgb(25, 208, 231)',
                                            fill: false,
                                            data: Array(growth.length).fill(null).map((_, i) => {
                                                const value = growth.reduce((a, b) => a + b) / growth.length;
                                                return {
                                                    x: addDays(interaction.createdAt, i + 1),
                                                    y: alliance.value + value * (i + 1)
                                                }
                                            })
                                        },
                                        {
                                            label: 'Highest',
                                            borderDash: [5, 5],
                                            backgroundColor: 'rgb(16, 242, 69)',
                                            borderColor: 'rgb(16, 242, 69)',
                                            fill: false,
                                            data: Array(growth.length).fill(null).map((_, i) => {
                                                const value = Math.max(...growth);
                                                return {
                                                    x: addDays(interaction.createdAt, i + 1),
                                                    y: alliance.value + value * (i + 1)
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
                            }
                        });
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
                            await reply.editReply({ components: [row] }).catch(err => void err);;
                        });
                    } else {
                        await interaction.editReply({ embeds: [embed] });
                    }
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