import { Constants, Formatters, MessageEmbed, MessageSelectMenu, MessageActionRow, type MessageComponentInteraction, type Message, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import QuickChart from 'quickchart-js';

import type { AM4_Data, Discord } from '@typings/database';
import type { ContextMenu } from '../types';
import type { Member } from '@source/classes/alliance';

type MemberDocument = AM4_Data.member & { thisWeek: number };
type AllianceMember = Member & { document?: MemberDocument };

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
    isPublic: false,
    data: {
        name: "Compare Alliance Member",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { database, rest, account, locale }) {
        await interaction.deferReply();
        const userCollection = database.discord.collection<Discord.user>("Users");
        const allianceCollection = database.am4.collection<AM4_Data.alliance>("Alliances");
        const memberCollection = database.am4.collection<AM4_Data.member>("Members");
        try {
            if (interaction.user.id === interaction.targetId) throw new DiscordClientError("You cannot compare yourself with yourself...");
            if (!account?.airlineID) throw new DiscordClientError("You need to save your airline via `/user login` to be able to use this command!");
            const targetUser = await userCollection.findOne({ id: interaction.targetId });
            if (!targetUser?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const users = [account, targetUser];
            let requestsRemaining: number;
            const members = await Promise.all<AllianceMember>(
                users.map(async user => {
                    const { status, airline } = await rest.fetchAirline(user.airlineID);
                    if (!status.success) throw new DiscordClientError(`${Formatters.userMention(user.id)}: ${status.error}`);
                    if (!airline.alliance) throw new DiscordClientError(`${Formatters.userMention(user.id)}: This airline does not seem to be in an alliance...`);
                    const response = await airline.alliance.fetchMember();
                    if (!response.status.success) throw new DiscordClientError(`${Formatters.userMention(user.id)}: ${response.status.error}`);
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
                    embed.setImage(url);
                    for (const option of select.options) option.default = (value === option.value);
                    row.components[0] = select;
                    await interaction.update({ 
                        embeds: [embed],
                        components: [row]
                    });
                }
            });
            collector.on("end", async collected => {
                select.setDisabled(true);
                row.components[0] = select;
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