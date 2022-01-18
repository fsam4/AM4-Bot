import { MessageActionRow, MessageSelectMenu, MessageEmbed, Formatters, Constants, type MessageComponentInteraction, type Message, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import QuickChart from 'quickchart-js';
import Airline from '../../../src/classes/airline';

import type { Discord, AM4_Data } from '@typings/database';
import type { ContextMenu } from '../types';

type GameMode = "realism" | "easy";
type Aircraft = AM4_Data.plane & { amount: number };

const command: ContextMenu<UserContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isAdministrator: false,
    isPublic: true,
    data: {
        name: "Compare Airline",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { rest, database, account, locale }) {
        await interaction.deferReply();
        const userCollection = database.discord.collection<Discord.user>("Users");
        const planeCollection = database.am4.collection<AM4_Data.plane>("Planes");
        try {
            if (interaction.user.id === interaction.targetId) throw new DiscordClientError("You cannot compare yourself with yourself...");
            if (!account?.airlineID) throw new DiscordClientError("You need to save your airline via `/user login` to be able to use this command!");
            const targetUser = await userCollection.findOne({ id: interaction.targetId });
            if (!targetUser?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const users = [account, targetUser];
            const airlines = await Promise.all(
                users.map(async user => {
                    const airline = await rest.fetchAirline(user.airlineID);
                    if (!airline.status.success) throw new DiscordClientError(`${Formatters.userMention(user.id)}: ${airline.status.error}`);
                    const planes = await planeCollection.find({ name: { $in: airline.fleet.planes.map(plane => plane.name) } }).toArray();
                    airline.fleet.planes = planes.map(plane => {
                        const { amount } = airline.fleet.planes.find(p => p.name === plane.name);
                        return { ...plane, amount };
                    });
                    return airline;
                })
            );
            const graphs = [
                {
                    id: new ObjectId(),
                    type: "Scatter graph",
                    description: "A scatter graph comparing the fleet size to fleet profit. The x-axis displays the fleet profit as a logarithmic scale. This means that for example 5e+7 is 5×10^7. The `+7` or `-7` part is the exponent and the first part `5e` is 5 multiplied by 10. The profit calculations are made with default settings and 100% reputation to make the results comparable.",
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
                                const pax_planes = (<Aircraft[]>fleet.planes).filter(plane => plane.type === 'pax');
                                const cargo_planes = (<Aircraft[]>fleet.planes).filter(plane => plane.type === 'cargo');
                                return {
                                    label: airline.name,
                                    data: [
                                        airline.achievements,
                                        cargo_planes.length ? cargo_planes.map(plane => plane.amount).reduce((a, b) => a + b) : 0,
                                        pax_planes.length ? pax_planes.map(plane => plane.amount).reduce((a, b) => a + b) : 0,
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
            collector.on("end", async collected => {
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