import { Permissions, MessageButton, MessageEmbed, Formatters, MessageActionRow, Constants, GuildMember, type TextChannel, type Message } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import CryptoJS from 'crypto-js';
import dateFNS from 'date-fns';

import type { SlashCommand } from '../types';
import type { Discord } from '@typings/database';

const fullDateFormat = /\d{2}\/\d{2}\/\d{4} \d{2}.\d{2}/;
const dateFormat = /\d{2}\/\d{2}\/\d{4}/;
const timeFormat = /\d{2}.\d{2}/;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isPublic: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.MANAGE_EVENTS,
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.ADD_REACTIONS,
        Permissions.FLAGS.SEND_MESSAGES,
        Permissions.FLAGS.EMBED_LINKS
    ]),
    data: {
        name: 'giveaway',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage AM4 Bot giveaways',
        defaultPermission: false,
        options: [
            {
                name: "create",
                description: "Create a new giveaway with AM4 Bot",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "description",
                        description: "The description of the giveaway (max 4096 characters)",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: "date",
                        description: "The date and time when the giveaway will end (format: \"dd/MM/yyyy hh.mm\", \"dd/MM/yyyy\" or \"hh.mm\")",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: "create_event",
                        description: "Whether to create a guild scheduled event for this giveaway.",
                        type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                        required: true
                    },
                    {
                        name: "channel",
                        description: "The channel where the bot will deploy the giveaway message. By default the current channel.",
                        type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                        channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                        required: false
                    },
                    {
                        name: "timezone",
                        description: "Your timezone difference from UTC. Otherwise UTC will be used for the date field.",
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: -24,
                        maxValue: 24,
                        required: false
                    },
                    {
                        name: "bonus_code",
                        description: "If you want to automate the giveaway, you can enter the bonus code.",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: "reroll",
                description: "Reroll a new winner for an already finished giveaway.",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "id",
                        description: "The ID of the giveaway or the message ID of the giveaway message",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: "close",
                description: "Close an existing giveaway with AM4 Bot. This will disable the join button.",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "id",
                        description: "The ID of the giveaway or the message ID of the giveaway message",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: "delete",
                description: "Delete an existing giveaway with AM4 Bot. This will delete the whole giveaway.",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "id",
                        description: "The ID of the giveaway or the message ID of the giveaway message",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, account }) {
        if (!interaction.guild) return interaction.reply("This command requires the bot to be in this server...");
        await interaction.deferReply({ ephemeral: true });
        const giveaways = database.discord.collection<Discord.giveaway>("Giveaways");
        try {
            const subCommand = interaction.options.getSubcommand();
            switch(subCommand) {
                case "reroll": {
                    const giveaway_id = interaction.options.getString("id", true);
                    const query = ObjectId.isValid(giveaway_id) ? { _id: new ObjectId(giveaway_id) } : { message: giveaway_id };
                    const giveaway = await giveaways.findOne({ ...query, server: interaction.guildId });
                    if (!giveaway) throw new DiscordClientError("No giveaway could be found with that ID in this server... Please note that giveaways older than 24 hours cannot be rerolled anymore!");
                    if (giveaway.author !== interaction.user.id) throw new DiscordClientError("Only the author of this giveaway can reroll it!");
                    if (!giveaway.finished) throw new DiscordClientError("You cannot reroll a giveaway that has not been finished...");
                    if (giveaway.bonus_code) throw new DiscordClientError("Giveaways with a pre-set reward cannot be rerolled...");
                    const userId = giveaway.users.random();
                    await interaction.client.users.fetch(userId)
                    .then(async user => {
                        const row = new MessageActionRow({
                            components: [
                                new MessageButton({
                                    style: "DANGER",
                                    customId: "cancel",
                                    label: "Cancel"
                                }),
                                new MessageButton({
                                    style: "SUCCESS",
                                    customId: "confirm",
                                    label: "Confirm"
                                })
                            ]
                        });
                        const reply = await interaction.editReply({
                            content: `The new winner of this giveaway is ${Formatters.bold(`${user.username}#${user.discriminator}`)}`,
                            components: [row]
                        }) as Message;
                        await reply.awaitMessageComponent({ time: 5 * 60 * 1000 })
                        .then(async component => {
                            for (const button of row.components) button.setDisabled(true);
                            await component.update({ components: [row] });
                            if (component.isButton() && component.customId === "confirm") {
                                await interaction.guild.channels.fetch(giveaway.channel)
                                .then(async (channel: TextChannel) => {
                                    const message = await channel.send({
                                        content: `Congratulations ${Formatters.userMention(userId)}, you won the giveaway!`,
                                        allowedMentions: {
                                            users: [userId],
                                            repliedUser: false
                                        },
                                        reply: {
                                            failIfNotExists: true,
                                            messageReference: giveaway.message
                                        }
                                    });
                                    await message.react("🎉");
                                    await component.editReply("The winner of this giveaway has been rerolled!");
                                })
                                .catch(async err => {
                                    console.error("Failed to reroll a giveaway:", err);
                                    await interaction.editReply("Failed to fetch the channel of this giveaway...");
                                });
                            } else {
                                await component.followUp({
                                    content: "Cancelled rerolling this giveaway...",
                                    ephemeral: true
                                });
                            }
                        })
                        .catch(async () => {
                            for (const button of row.components) button.setDisabled(true);
                            await interaction.editReply({ components: [row] });
                            await interaction.followUp({
                                content: "Cancelled rerolling this giveaway...",
                                ephemeral: true
                            });
                        })
                    })
                    .catch(async err => {
                        console.error("Failed to reroll a giveaway:", err);
                        await interaction.editReply("Failed to reroll this giveaway as the bot was unable to fetch a new winner. Please try again!");
                    });
                    break;
                }
                case "close": {
                    const giveaway_id = interaction.options.getString("id", true);
                    const query = ObjectId.isValid(giveaway_id) ? { _id: new ObjectId(giveaway_id) } : { message: giveaway_id };
                    const giveaway = await giveaways.findOne({ ...query, server: interaction.guildId });
                    if (!giveaway) throw new DiscordClientError("No giveaway could be found with that ID in this server...");
                    if (giveaway.finished) throw new DiscordClientError("This giveaway has already finished...");
                    if (giveaway.author !== interaction.user.id) throw new DiscordClientError("Only the author of this giveaway can close it!");
                    await interaction.guild.channels.fetch(giveaway.channel)
                    .then(async channel => {
                        if (channel.isText()) {
                            await channel.messages.fetch(giveaway.message)
                            .then(async message => {
                                message.components[0].components[0].setDisabled(true);
                                await message.edit({ components: message.components });
                                await interaction.editReply("Your giveaway has been closed! This means that no more users can join it!");
                            })
                            .catch(async err => {
                                console.error("Failed to fetch giveaway message:", err);
                                await interaction.editReply("Failed to fetch the message of this giveaway...");
                            });
                        }
                    })
                    .catch(async err => {
                        console.error("Failed to fetch giveaway channel:", err);
                        await interaction.editReply("Failed to fetch the channel of this giveaway...");
                    });
                    break;
                }
                case "delete": {
                    const giveaway_id = interaction.options.getString("id", true);
                    const query = ObjectId.isValid(giveaway_id) ? { _id: new ObjectId(giveaway_id) } : { message: giveaway_id };
                    const res = await giveaways.findOneAndDelete({ ...query, server: interaction.guildId });
                    if (!res.ok) throw new DiscordClientError("No giveaway could be found with that ID in this server...");
                    await interaction.guild.channels.fetch(res.value.channel)
                    .then(async (channel: TextChannel) => {
                        await channel.messages.delete(res.value.message)
                        .catch(err => void err);
                    })
                    .catch(err => void err);
                    if (res.value.event) {
                        await interaction.guild.scheduledEvents.edit(res.value.event, { status: "CANCELED" })
                        .catch(err => void err);
                    }
                    await interaction.editReply("Your giveaway has been deleted! This means that the giveaway does not exist anymore and will not trigger.");
                    break;
                }
                case "create": {
                    if (!account || account.admin_level < 2) {
                        const guild_giveaways = await giveaways.countDocuments({ server: interaction.guildId });
                        if (guild_giveaways > 10) throw new DiscordClientError("A server cannot have more than 10 active giveaways at a time!");
                        const user_giveaways = await giveaways.countDocuments({ author: interaction.user.id });
                        if (user_giveaways > 5) throw new DiscordClientError("A user cannot have more than 5 active giveaways at a time!");
                    }
                    const channel = <TextChannel>(interaction.options.getChannel("channel") || interaction.channel);
                    const permissions = channel.permissionsFor(interaction.guild.me);
                    if (!permissions.has("SEND_MESSAGES")) throw new DiscordClientError("You need to allow the bot to send messages in to that channel...");
                    const description = interaction.options.getString("description", true).trimEnd();
                    if (description.length > 4096) throw new DiscordClientError("The description can at maximum only be 4096 characters long!");
                    const dateString = interaction.options.getString("date", true).trim();
                    if (!timeFormat.test(dateString) && !fullDateFormat.test(dateString)) throw new DiscordClientError("That is not a valid date, the date needs be format: `dd/MM/yyyy kk.mm`. For example 12th of June 2021 at 15.30 ► `12/6/2021 15.30`. You can also give it in format `hh.mm` without the date to schedule the giveaway to the specified time today.");
                    const formatString = fullDateFormat.test(dateString) ? "dd'/'MM'/'yyyy kk'.'mm" : "kk'.'mm";
                    let date = dateFNS.parse(dateString, formatString, interaction.createdAt);
                    if (!date.isValid()) throw new DiscordClientError("That is not a valid date, the date needs be format: `dd/MM/yyyy kk.mm`. For example 12th of June 2021 at 15.30 ► `12/6/2021 15.30`. You can also give it in format `hh.mm` without the date to schedule the giveaway to the specified time today.");
                    const difference = interaction.options.getInteger("timezone");
                    if (difference) date = dateFNS.subHours(date, difference);
                    if (!dateFNS.isFuture(date)) throw new DiscordClientError("The given date needs to be in the future!");
                    const minutes = Math.abs(dateFNS.differenceInMinutes(interaction.createdAt, date));
                    if (minutes < 5) throw new DiscordClientError("Giveaways can at minimum be scheduled 5 minutes away!");
                    const days = Math.abs(dateFNS.differenceInDays(interaction.createdAt, date));
                    if (days > 30) throw new DiscordClientError("Giveaways can at maximum be scheduled 30 days away!");
                    let bonus_code = interaction.options.getString("bonus_code")?.trimEnd();
                    if (bonus_code) {
                        if (bonus_code.length > 500) throw new DiscordClientError("The bonus code message cannot be longer than 500 characters...");
                        const message = await interaction.editReply({
                            content: "You have entered a bonus code which will mean that AM4 Bot will automate the giveaway and automatically DM the winner the bonus code when the giveaway ends. Your code will be encrypted and stored safely in a non human readable way. By creating this giveaway you agree to allow the bot handle the giveaway. We are not responsible for any invalid codes submitted by you.",
                            components: [
                                new MessageActionRow({
                                    components: [
                                        new MessageButton({
                                            label: "Disagree",
                                            customId: "disagree",
                                            style: "DANGER"
                                        }),
                                        new MessageButton({
                                            label: "Agree",
                                            customId: "agree",
                                            style: "SUCCESS"
                                        })
                                    ]
                                })
                            ]
                        }) as Message;
                        const status = await message.awaitMessageComponent({ time: 5 * 60 * 1000 })
                        .then(async component => {
                            const agreed = component.customId === "agree";
                            await component.update({
                                content: agreed ? "Creating giveaway..." : "Giveaway creation cancelled...",
                                components: []
                            });
                            return agreed;
                        })
                        .catch(async () => {
                            await interaction.deleteReply();
                            return false;
                        });
                        if (!status) return;
                        bonus_code = CryptoJS.AES.encrypt(bonus_code, process.env.HASH_SECRET).toString();
                    }
                    const embed = new MessageEmbed({
                        color: "FUCHSIA",
                        title: "🎁 Giveaway 🎁",
                        description: `**Giveaway ends:** ${Formatters.time(date, "R")}`,
                        timestamp: date,
                        author: {
                            name: `${interaction.user.username}#${interaction.user.discriminator}`,
                            iconURL: interaction.user.displayAvatarURL()
                        },
                        footer: {
                            text: "Total participants: 0",
                            iconURL: interaction.user.displayAvatarURL()
                        },
                        fields: [
                            {
                                name: Formatters.underscore("Description"),
                                value: description
                            }
                        ]
                    });
                    const button = new MessageButton({
                        customId: "giveaway",
                        label: "Join Giveaway",
                        style: "SUCCESS",
                        emoji: "🎉"
                    });
                    const row = new MessageActionRow({ components: [button] });
                    let message = await channel.send({
                        embeds: [embed],
                        components: [row]
                    });
                    const docs: Discord.giveaway = {
                        finished: false,
                        author: interaction.user.id,
                        server: interaction.guildId,
                        channel: channel.id,
                        expireAt: date,
                        message: message.id,
                        users: []
                    };
                    if (bonus_code) docs.bonus_code = bonus_code;
                    const createEvent = interaction.options.getBoolean("create_event", true);
                    if (createEvent) {
                        const event = await interaction.guild.scheduledEvents.create({
                            name: `Giveaway by ${(<GuildMember>interaction.member).displayName}`,
                            description: description,
                            privacyLevel: "GUILD_ONLY",
                            scheduledStartTime: new Date(),
                            scheduledEndTime: date,
                            entityType: "EXTERNAL",
                            entityMetadata: {
                                location: `#${channel.name}`
                            }
                        });
                        docs.event = event.id;
                    }
                    const res = await giveaways.insertOne(docs);
                    await interaction.editReply(`Your giveaway has been deployed in ${Formatters.channelMention(channel.id)}. It will end ${Formatters.bold(dateFNS.formatDistanceToNowStrict(date, { addSuffix: true }))}. To close it use \`/giveaway close\`. Closing a giveaway will disable the joining button and stop more people from joining. To fully delete your giveaway either use \`/giveaway delete\` or delete the giveaway message. The ID of your giveaway is ${Formatters.bold(res.insertedId.toHexString())}. Please store this ID if you need to later manage the giveaway!`);
                    const hours = Math.abs(dateFNS.differenceInHours(interaction.createdAt, date));
                    if (hours < 48) {
                        const ms = Math.abs(dateFNS.differenceInMilliseconds(interaction.createdAt, date));
                        setTimeout(async () => {
                            button.setDisabled(true);
                            row.components[0] = button;
                            delete embed.description;
                            await message.edit({ 
                                components: [row],
                                embeds: [embed] 
                            }).catch(err => void err);
                            const updated = await giveaways.findOneAndUpdate(
                                { 
                                    _id: res.insertedId 
                                }, 
                                {
                                    $set: {
                                        finished: true
                                    }
                                }
                            );
                            if (updated.ok && updated.value) {
                                if (updated.value.users.length) {
                                    const winnerId = updated.value.users.random();
                                    const reply = await message.reply({
                                        content: `Congratulations ${Formatters.userMention(winnerId)}, you won the giveaway!`,
                                        allowedMentions: {
                                            users: [winnerId],
                                            repliedUser: false
                                        }
                                    });
                                    await reply.react("🎉");
                                    if (updated.value.bonus_code) {
                                        await giveaways.deleteOne({ _id: updated.value._id });
                                        const decrypted = CryptoJS.AES.decrypt(updated.value.bonus_code, process.env.HASH_SECRET);
                                        await interaction.client.users.fetch(winnerId)
                                        .then(async user => {
                                            await user.send(`Here is your reward for winning ${Formatters.hyperlink("this", message.url)} giveaway: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`)
                                            .catch(async err => {
                                                console.error("Failed to DM giveaway reward", err);
                                                const author = await interaction.client.users.fetch(updated.value.author);
                                                await author.send(`Failed to DM ${Formatters.bold(`${user.username}#${user.discriminator}`)} the reward for winning ${Formatters.hyperlink("this", message.url)} giveaway. Please DM the reward to the user manually: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`).catch(err => void err);
                                            });
                                        })
                                        .catch(async err => {
                                            console.error("Failed to DM giveaway reward", err);
                                            const author = await interaction.client.users.fetch(updated.value.author);
                                            await author.send(`Failed to DM the winner of ${Formatters.hyperlink("this", message.url)} the reward. Please DM the reward to the user manually: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`).catch(err => void err);
                                        });
                                    }
                                } else {
                                    await message.reply("No users participated in this giveaway...");
                                }
                            }
                        }, ms);
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