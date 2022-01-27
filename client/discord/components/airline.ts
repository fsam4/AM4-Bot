import { MessageEmbed, Formatters, type ButtonInteraction } from 'discord.js';
import DiscordClientError from '../error';
import QuickChart from 'quickchart-js';
import { User } from '../../utils';
import Airline from '../../../src/classes/airline';
import format from 'date-fns/format';

import type { AM4_Data, Settings } from '@typings/database';
import type { Component } from '@discord/types';

type Aircraft = AM4_Data.plane & { amount?: number };

const component: Component<ButtonInteraction> = {
    name: "airline",
    cooldown: 25,
    customId: /airline:\d{1,}/,
    async execute(interaction, { rest, database, parsedCustomId, locale }) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const airlineID = parseInt(parsedCustomId[0]);
            const settings = database.settings.collection<Settings.user>('Users');
            const planeCollection = database.am4.collection<AM4_Data.plane>('Planes');
            const planeSettings = database.settings.collection<Settings.plane>('Planes');
            const { training, options, salaries } = new User(interaction.user.id, await settings.findOne({ id: interaction.user.id }));
            const { status, airline, fleet, ipo, awards } = await rest.fetchAirline(airlineID);
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
            const aircrafts = {
                pax: planes.filter(plane => plane.type === "pax"),
                cargo: planes.filter(plane => plane.type === "cargo"),
                vip: planes.filter(plane => plane.type === "vip")
            };
            const fleetSize = {
                pax: aircrafts.pax.length && aircrafts.pax.map(plane => plane.amount).reduce((a, b) => a + b),
                cargo: aircrafts.cargo.length && aircrafts.cargo.map(plane => plane.amount).reduce((a, b) => a + b),
                vip: aircrafts.vip.length && aircrafts.vip.map(plane => plane.amount).reduce((a, b) => a + b)
            };
            const embed = new MessageEmbed({
                color: "BLURPLE",
                timestamp: airline.founded,
                description: `**Airline ID:** ${airlineID}`,
                author: {
                    name: `${airline.alliance ? `${airline.name} (${airline.alliance.name})` : airline.name} ${airline.online ? '🟢': '🔴'}`,
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
                        value: `**Rank:** ${airline.rank.toLocaleString(locale)} in ${airline.gameMode}\n**Founded:** ${Formatters.time(airline.founded)}\n**Pax reputation:** ${airline.reputation.pax}%${planes.some(plane => plane.type === 'cargo') ? `\n**Cargo reputation:** ${airline.reputation.cargo}%` : ``}\n**Achievements:** ${airline.achievements.toLocaleString(locale)} completed\n**Level:** ${airline.level.toLocaleString(locale)}`,
                        inline: false
                    },
                    {
                        name: Formatters.bold(Formatters.underscore("Fleet info")),
                        value: `**Total size:** ${fleet.size} planes\n**Pax fleet:** ${fleetSize.pax.toLocaleString(locale)} planes\n**Cargo fleet:** ${fleetSize.cargo.toLocaleString(locale)} planes\n**VIP fleet:** ${fleetSize.vip.toLocaleString(locale)} planes\n**Routes:** ${fleet.routes.toLocaleString(locale)}`,
                        inline: false
                    },
                    {
                        name: Formatters.bold(Formatters.underscore("Profitability")),
                        value: `**Per hour:** $${Math.round(res.airline.profit / options.activity).toLocaleString(locale)}\n**Per day:** $${res.airline.profit.toLocaleString(locale)}\n**Per week:** $${Math.round(res.airline.profit * 7).toLocaleString(locale)}`
                    }
                ]
            });
            if (ipo.has) {  
                const field = embed.fields.pop();
                const estimatedGrowth = Airline.estimatedShareValueGrowth(planes, profitOptions);
                embed.addFields({
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
                embed.setImage(url);
            }
            if (awards.length) embed.addFields({
                name: Formatters.bold(Formatters.underscore("Awards")),
                value: Formatters.codeBlock(awards.map(award => `${award.name} • ${format(award.date, 'dd/MM/yyyy')}`).join('\n'))
            });
            await interaction.editReply({ embeds: [embed] });
        }
        catch(error) {
            if (error instanceof DiscordClientError) {
                await error.send(interaction);
            } else {
                console.error(`Error while executing component (${interaction.customId})`, error);
                await DiscordClientError.sendUnknownError(interaction);
            }
        }
    }
};

export = component;