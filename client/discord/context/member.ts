import { MessageEmbed, MessageSelectMenu, Formatters, MessageActionRow, Constants, type Message, type MessageComponentInteraction, type UserContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import { emojis } from '../../../config.json';

import differenceInWeeks from 'date-fns/differenceInWeeks';
import differenceInDays from 'date-fns/differenceInDays';

import type { AM4_Data, Discord } from '@typings/database';
import type { ContextMenu } from '../types';

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
        name: "Get Alliance Member",
        type: Constants.ApplicationCommandTypes.USER,
        defaultPermission: true
    },
    async execute(interaction, { database, rest, locale }) {
        await interaction.deferReply();
        const memberCollection = database.am4.collection<AM4_Data.member>('Members');
        const allianceCollection = database.am4.collection<AM4_Data.alliance>("Alliances");
        const users = database.discord.collection<Discord.user>("Users");
        try {
            const targetAccount = await users.findOne({ id: interaction.targetId });
            if (!targetAccount?.airlineID) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} has not logged in...`);
            const { status: airlineStatus, airline } = await rest.fetchAirline(targetAccount.airlineID);
            if (!airlineStatus.success) throw new DiscordClientError(airlineStatus.error);
            if (!airline.alliance) throw new DiscordClientError(`${Formatters.userMention(interaction.targetId)} does not seem to be in an alliance...`);
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
                description: `**Airline ID:** ${targetAccount.airlineID}`,
                footer: {
                    text: `Requests remaining: ${status.requestsRemaining.toLocaleString(locale)}`,
                    iconURL: "https://i.ibb.co/8DFpz96/am-logo.png"
                },
                fields: [
                    {
                        name: Formatters.bold(Formatters.underscore("General Statistics")),
                        value: `**Share value:** $${member.sv.toLocaleString(locale)}\n**Joined:** ${Formatters.time(member.joined)}\n**Last online:** ${Formatters.time(member.online, "R")}\n**Flights:** ${member.flights.toLocaleString(locale)}`,
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
                const memberDocument = await memberCollection.findOne({ name: airline.name, allianceID: allianceDocument._id });
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
                    if (memberDocument.sv.length) {
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
                                            data: memberDocument.sv.map(({ value, date }) => ({
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
                        embed.setImage(url);
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