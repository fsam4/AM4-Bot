import { Constants, Formatters, MessageSelectMenu, MessageEmbed, MessageActionRow, type MessageComponentInteraction, type Message, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import QuickChart from 'quickchart-js';

import type { AM4, Discord } from '@typings/database';
import type { ContextMenu } from '@discord/types';
import type Alliance from '@source/classes/alliance';

type AllianceData = Alliance & { data?: AM4.Alliance };

// This command was never released to AM4 Bot due to Discord's context menu command cap (5).

const command: ContextMenu<UserContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 20,
    isAdministrator: false,
    isGlobal: false,
    data: {
        name: "Compare Alliance",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { database, rest, account, locale }) {
        await interaction.deferReply();
        try {
            const userCollection = database.discord.collection<Discord.User>("Users");
            const allianceCollection = database.am4.collection<AM4.Alliance>("Alliances");
            if (interaction.user.id === interaction.targetId) throw new DiscordClientError("You cannot compare yourself with yourself...");
            if (!account?.airlineID) throw new DiscordClientError("You need to save your airline via `/user login` to be able to use this command!");
            const targetUser = await userCollection.findOne({ id: interaction.targetId });
            if (!targetUser?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const users = [account, targetUser];
            const alliances = await Promise.all<AllianceData>(
                users.map(async user => {
                    const { status, airline } = await rest.fetchAirline(user.airlineID);
                    if (!status.success) throw new DiscordClientError(`${Formatters.userMention(user.id)}: ${status.error}`);
                    if (!airline.alliance) throw new DiscordClientError(`${Formatters.userMention(user.id)}: This airline does not seem to be in an alliance...`);
                    const alliance = await airline.alliance.fetch();
                    if (!alliance.status.success) throw new DiscordClientError(`${Formatters.userMention(user.id)}: ${alliance.status.error}`);
                    return alliance;
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
            collector.on("end", async collected => {
                select.setDisabled(true);
                row.components[0] = select;
                const reply = collected.last() || interaction;
                await reply.editReply({ components: [row] }).catch(() => void 0);
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