import { MessageEmbed, Formatters, Permissions, MessageActionRow, type MessageSelectMenu, type MessageButton, type SelectMenuInteraction, type PermissionResolvable } from 'discord.js';
import DiscordClientError from '../error';
import lastDayOfMonth from 'date-fns/lastDayOfMonth';
import updateEmbed from '../../../documents/json/update.json';
import config from '../../../config.json';

import type { Quiz, Settings } from '@typings/database';
import type { Component } from '../types';

const component: Component<SelectMenuInteraction> = {
    name: "help",
    cooldown: 0,
    customId: /help:\d{1,}/,
    async execute(interaction, { parsedCustomId, database, guildLocale }) {
        const bot = await interaction.client.application.fetch();
        const [userId] = parsedCustomId;
        try {
            if (userId !== interaction.user.id) return;
            await interaction.deferUpdate();
            const category = interaction.values[0];
            const select = <MessageSelectMenu>interaction.message.components[0].components[0];
            const buttons = <MessageButton[]>interaction.message.components[1].components;
            for (const option of select.options) {
                if (category === "general") {
                    option.default = false;
                } else {
                    option.default = option.value === category;
                }
            }
            let embeds: MessageEmbed[] = [];
            const inviteURL = interaction.client.generateInvite({
                scopes: ["applications.commands", "bot"],
                permissions: <PermissionResolvable>config.permissions
            });
            switch(category) {
                case 'commands': {
                    let commands = await bot.commands.fetch();
                    if (interaction.inGuild()) {
                        const guildCommands = await interaction.guild.commands.fetch();
                        commands = commands.concat(guildCommands);
                    }
                    const [chatCommands, menuCommands] = commands.partition(command => command.type === "CHAT_INPUT");
                    const [messageCommands, userCommands] = menuCommands.partition(command => command.type === "MESSAGE");
                    embeds[0] = new MessageEmbed({
                        color: "RANDOM",
                        title: 'Commands',
                        url: inviteURL,
                        description: `• Some command responses will display _Requests remaining_ in the footer. This shows the amount of API requests left for today to the AM4 API. The full amount is 800 requests and it refills every 24 hours.\n• Most commands have a command cooldown which prevents spamming and wasting of the API requests.`,
                        thumbnail: {
                            url: bot.iconURL()
                        },
                        fields: [
                            {
                                name: 'Slash Commands',
                                value: Formatters.codeBlock(chatCommands.map(command => `${command.id} ► /${command.name}`).join('\n'))
                            },
                            {
                                name: 'User Context Menu',
                                value: Formatters.codeBlock(userCommands.map(command => `${command.id} ► ${command.name}`).join('\n'))
                            },
                            {
                                name: 'Message Context Menu',
                                value: Formatters.codeBlock(messageCommands.map(command => `${command.id} ► ${command.name}`).join('\n'))
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Commands: ${commands.size.toLocaleString(guildLocale)}`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    });
                    break;
                }
                case 'webhooks': {
                    const webhooks = database.settings.collection<Settings.webhook>("Webhooks");
                    const amount = await webhooks.countDocuments();
                    embeds[0] = new MessageEmbed({
                        color: "RANDOM",
                        title: 'Webhooks',
                        url: inviteURL,
                        description: 'Notification webhooks can be managed via `/settings webhooks` by users with administrator permission.',
                        thumbnail: {
                            url: bot.iconURL(),
                        },
                        fields: [
                            {
                                name: 'Setting up a notification webhook...',
                                value: 'To set up a notification webhook use `/settings webhooks create`. This will trigger the bot to create a new webhook to your server. This webhook will be used to deliver fuel and/or co2 notifications to your server. You can afterwards use `/settings webhooks edit` to edit the webhook settings and `/settings webhooks delete` to delete an existing webhook. You can change the icon, name and channel of the webhook as you want. The bot will detect these changes and update the channel automatically.'
                            },
                            {
                                name: 'Using notification webhooks...',
                                value: 'You can use notification webhooks to send fuel and co2 announcements with the command `/notification post`. This command will send the notification to every single webhook that has been created. This is why both fuel and co2 arguments are required even if you do not care about the other one, because other servers might care. Posting false notifications can result in suspensions if not corrected. If you make a mistake you can use `/notification edit` to edit your latest fuel notification. You can also delete it with `/notification delete` if there is a reason for that. A notification can be only edited once every 5 minutes during the price period when they were posted. To view who sent a notification use `/notification view`. **Fuel notifications go to all servers that have them enabled so __do not test them__, only post real prices at real times!** '
                            },
                            {
                                name: 'Rules for using notifications',
                                value: '**1.** Posting false prices will get you warned or suspended from using commands for 1-30 days. This depends on how intentional the false price was.\n**2.** Deleting or editing your notifications without a reason will get you suspended from using commands for 4-7 days.\n**3.** Any other behaviour that could be labeled as inappropriate or abusive will result in warnings or suspensions from using commands. Any servers and users using fuel notifications will have to accept these rules. These rules are meant to protect spam and any other inappropriate behaviour as the fuel notifications are used in several servers.'
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Active webhooks: ${amount.toLocaleString(guildLocale)}`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    });
                    break;
                }
                case 'quiz': {
                    const users = database.quiz.collection<Quiz.user>("Users");
                    const nextTounament = lastDayOfMonth(interaction.createdAt).setHours(21, 0, 0, 0);
                    const amount = await users.countDocuments(config.tournament?.enabled && { score: { $exists: true } });
                    embeds[0] = new MessageEmbed({
                        color: "RANDOM",
                        title: 'Quiz Games',
                        url: inviteURL,
                        description: config.tournament?.enabled ? `Current tournaments ends: ${Formatters.time(new Date(nextTounament), "R")}` : "No ongoing tournaments at the moment...",
                        thumbnail: {
                            url: bot.iconURL(),
                        },
                        fields: [
                            {
                                name: 'Tournament Rewards',
                                value: '🥇 100 bonus points\n🥈 50 bonus points'
                            },
                            {
                                name: 'How do the tournaments work?',
                                value: 'You can participate in the tournaments by playing AM4 quiz games. You can play by using `/quiz play`. Each correct answer awards score. The users with the most score every month win (see rewards above). The scores reset at the first day every month and the rewards are automatically given. Please make sure that the bot is able to DM to you or you cannot claim your reward! You can check your rank via `/quiz leaderboard`!'
                            },
                            {
                                name: 'How does the score work?',
                                value: 'Each correct answer gives you a score between 0.00-1.00 (decimal number). This is then multiplied by the game mode multiplier. The multipliers are 0.5 for easy, 1 for normal and 2 for hard. After that the score is multiplied by the game multiplier. The game multipliers are 1 for AM4 Quiz, 1.5 for logo quiz, 2 for plane quiz, 2 for airport quiz and 2.5 for aviation quiz. This will in total determine the awarded score. For example if the randomized score is 0.27, the mode is easy (0.5) and the game is aviation quiz (2.5) you will earn a score of 0,3375 that is then rounded to the accuracy of 2 decimals which is 0,34.'
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Total players: ${amount.toLocaleString(guildLocale)}`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    });
                    if (!config.tournament?.enabled) embeds[0].fields.shift();
                    break;
                }  
                case 'settings': {
                    embeds[0] = new MessageEmbed({
                        color: "RANDOM",
                        title: 'Settings',
                        url: inviteURL,
                        description: 'Server settings can be managed with `/settings`, personal settings with `/user settings` and plane settings with `/plane settings`. Settings can be used to configure calculations and give more accurate and personalized results. Server settings can on default only be edited by administrators!',
                        fields: [
                            {
                                name: 'Personal Settings',
                                value: "Personal settings can be configured to change the values and behaviour of the bot for you personally. To edit personal settings use `/user settings`, which has 4 sub commands: `salaries`, `training`, `preference` and `options`. Salary settings can be used to configure the staff salaries used in profit calculations for you. Training settings can be used to configure the training values of your airline, which affects profit calculations and cargo plane configurations in route commands. Preference settings can be used to overwrite the configuration prefrence of the bot. The bot normally picks the most profitable configuration order for the route, but if you for a reason or another want to change it to something specific, use this setting. The options are just generel settings that affect dsplayed results and profit calculations.",
                            },
                            {
                                name: 'Server Settings',
                                value: "Server settings can be used to configure the bot's behaviour in your server. You can via `/settings login` edit the behaviour of the bot when someone logs in in your server. Then you can use `/settings roles` to save the default, realism, easy and member roles of your server that the bot can automatically assign when someone logs in. The default role is assigned to everyone who logs in. The bot also automatically assigns these roles when someone who has already logged in joins your server. `/settings permissions` can be used to customize the permissions of each command in your server. `/settings channels` can be used to whitelist or blacklist channels from commands. A blacklisted channel will send all responses as ephemeral so that only the user who used the command can see it. Having only whitelisted channels will automatically blacklist all other channels. For information about `/settings webhooks`, check the Webhooks section.",
                            },
                            {
                                name: 'Plane Settings',
                                value: "Plane settings can be used to configure the settings for a plane used in route calculations and profit calculations. You can have up to 10 active plane settings at a time. To configure plane settings use `/plane settings`. You can define the modifications and engine used for a plane. This affects plane speed, fuel usage and co2 usage so plane settings can be used to give more accurate results for route configurations.",
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Used in ${interaction.client.guilds.cache.size} servers`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    });
                    break;
                }
                case "privacy": {
                    embeds[0] = new MessageEmbed({
                        color: "RANDOM",
                        title: "Privacy Policy",
                        url: inviteURL,
                        description: "AM4 Bot does not collect any personal information about you or any other information that could be used to identify you or anyone else. AM4 Bot only collects necessary information to connect you to your AM4 airline or Discord user. By using AM4 Bot you agree to our privacy policy.",
                        fields: [
                            {
                                name: "Discord",
                                value: "AM4 Bot might collect message IDs, channel IDs, server IDs or user IDs.\n• Message and channel IDs are collected to connect your giveaways, reaction roles or role panels to the message and the channel where it is located.\n• Channel IDs are also collected when making channel specific settings like notification webhooks or command whitelists/blacklists.\n• User IDs are used to connect your Discord user to your settings and saved airline. AM4 Bot also keeps a record of your command activity (except when using `/help`), warnings and suspensions to ensure security. User IDs can also be collected to connect you to your created giveaways or role panels."
                            },
                            {
                                name: "Airline Manager 4",
                                value: "AM4 Bot uses the available AM4 API to get any airline, alliance or route information. Additonally plane, airport, achievement and route data can be obtained from the bot's database and AM4 Tools API. AM4 Bot also keeps a record of top 50 alliances (and alliances that use AM4 Bot or request to be recorded) and their growth and members. This data is collected daily via the available AM4 API and is stored to draw graphs to visualize alliance growth, contribution history and other statistics. The bot automatically cleans useless and expired data after a certain period of time."
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Used in ${interaction.client.guilds.cache.size} servers`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    })
                    break;
                }
                case 'update': {
                    embeds = updateEmbed.map(object => new MessageEmbed(object));
                    embeds[0].setTitle("Latest update");
                    embeds.last().setTimestamp(new Date("2021-08-22T17:38:43Z"));
                    embeds.last().setFooter({
                        text: `Used in ${interaction.client.guilds.cache.size} servers`, 
                        iconURL: interaction.client.user.displayAvatarURL()
                    });
                    break;
                }
                default: {
                    const embed = new MessageEmbed({
                        color: "RANDOM",
                        title: 'AM4 Discord Bot',
                        url: inviteURL,
                        description: `The current ping is ${Formatters.bold(`${interaction.client.ws.ping}ms`)}.\nLast restarted: ${Formatters.time(interaction.client.readyAt, "R")}.`,
                        thumbnail: {
                            url: bot.iconURL()
                        },
                        fields: [
                            {
                                name: 'About AM4 Bot...',
                                value: bot.description
                            },
                            {
                                name: 'Getting Started...',
                                value: `Most of the AM4 Bot commands are slash commands. Type \`/\` in the chat to see them all or click ${Formatters.formatEmoji(config.emojis.chat)} for a list of commands. You can also use AM4 Bot's context menu commands by right clicking a message or a user. If you require support join ${Formatters.hyperlink("the Air France KLM server", "https://discord.gg/f8WHuRX")}.`
                            },
                            {
                                name: 'Logging in with AM4 Bot...',
                                value: 'To login with AM4 Bot use `/user login`. This will save your airline so you do not anymore need to fill in the game mode argument. You can also leave all arguments empty in `/airline search` and `/alliance members search` to see your own airline, and in `/alliance search` to see your own alliance. If you change your game mode use `/user sync` to refresh your mode.'
                            }
                        ],
                        timestamp: bot.createdTimestamp,
                        footer: {
                            text: `Used in ${interaction.client.guilds.cache.size} servers`,
                            icon_url: interaction.client.user.displayAvatarURL(),
                        }
                    });
                    if (interaction.client.application.botPublic) {
                        embed.addFields(                            {
                            name: 'Inviting AM4 Bot...',
                            value: `AM4 Bot is on Discord & Telegram. To invite AM4 Bot on Discord click the "${Formatters.hyperlink("Invite AM4 Bot", inviteURL)}" button below. To invite/use it on Telegram search up **@am4_finsky_bot** on Telegram. You can also join ${Formatters.hyperlink("AM4 Bot group", "https://t.me/joinchat/mWoOI4FP6PcxMTRk")} on Telegram for help with AM4 Bot on Telegram.`
                        });
                    }
                    embeds[0] = embed;
                    break;
                }
            }
            await interaction.editReply({ 
                embeds, 
                components: [
                    new MessageActionRow({ components: [select] }), 
                    new MessageActionRow({ components: buttons })
                ] 
            });
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
}

export = component;