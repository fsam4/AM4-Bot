import { Permissions, Formatters, WebhookClient, MessageEmbed, Constants, Team, type MessagePayload, type WebhookMessageOptions } from 'discord.js';
import { Discord as Utils } from '../../utils';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';
import CryptoJS from 'crypto-js';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import differenceInMilliseconds from 'date-fns/differenceInMilliseconds';
import differenceInMinutes from 'date-fns/differenceInMinutes';
import addMinutes from 'date-fns/addMinutes';
import isFuture from 'date-fns/isFuture';
import isPast from 'date-fns/isPast';

import type { Settings, Discord } from '@typings/database';
import type { APIMessage } from 'discord-api-types/v9';
import type { SlashCommand } from '../types';

const { nextPricePeriod } = Utils;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isPublic: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.MANAGE_WEBHOOKS
    ]),
    data: {
        name: 'notification',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Manage fuel and co2 notifications.',
        defaultPermission: false,
        options: [
            {
                name: 'post',
                description: 'Post a fuel and co2 notification',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'fuel',
                        description: 'The current fuel price',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        maxValue: 3000,
                        required: true
                    },
                    {
                        name: 'co2',
                        description: 'The current co2 price',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        maxValue: 200,
                        required: true
                    }
                ]
            },
            {
                name: 'edit',
                description: 'Edit a fuel notification',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'id',
                        description: 'The ID of one of the notification messages or the ID of the notification',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'fuel',
                        description: 'The current fuel price',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        maxValue: 3000,
                        required: false
                    },
                    {
                        name: 'co2',
                        description: 'The current co2 price',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 1,
                        maxValue: 200,
                        required: false
                    }
                ]
            },
            {
                name: 'delete',
                description: 'Delete a fuel notification',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'id',
                        description: 'The ID of one of the notification messages or the ID of the notification',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: 'view',
                description: 'View the information of a fuel notification',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'id',
                        description: 'The ID of one of the notification messages or the ID of the notification',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            },
            {
                name: 'leaderboard',
                description: 'Fuel notification leaderboard',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            }
        ]
    },
    async execute(interaction, { database, cooldowns, account, rest, guildLocale }) {
        if (!interaction.guild) return interaction.reply("This command can only be used in servers!");
        await interaction.deferReply({ ephemeral: true });
        const users = database.discord.collection<Discord.user>("Users");
        const notificationCollection = database.discord.collection<Discord.notification>("Notifications");
        const webhookCollection = database.settings.collection<Settings.webhook>("Webhooks");
        const webhooks = await webhookCollection.find({ id: { $type: "string" } }).toArray();
        try {
            const subCommand = interaction.options.getSubcommand();
            switch(subCommand) {
                case "post": {
                    let options: MessagePayload | WebhookMessageOptions = {};
                    if (account?.airlineID) {
                        const { status, airline } = await rest.fetchAirline(account.airlineID);
                        if (status.success) {
                            options.username = airline.name;
                            if (airline.logo) options.avatarURL = airline.logo;
                        }
                    }
                    const webhookClients = webhooks.map(webhook => {
                        const decrypted = CryptoJS.AES.decrypt(webhook.token, process.env.HASH_SECRET);
                        return new WebhookClient({ 
                            id: webhook.id, 
                            token: decrypted.toString(CryptoJS.enc.Utf8)
                        });
                    });
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && !account?.admin_level) {
                        const timeout = await cooldowns.get("notification");
                        if (timeout) throw new DiscordClientError(`The next notification can be posted ${formatDistanceToNowStrict(new Date(timeout), { addSuffix: true })}`);
                    }
                    const fuel = interaction.options.getInteger("fuel", true);
                    const co2 = interaction.options.getInteger("co2", true);
                    const next = nextPricePeriod(interaction.createdAt);
                    const cooldown = Math.abs(differenceInMilliseconds(interaction.createdAt, next));
                    await cooldowns.set("notification", next, cooldown);
                    const res = await notificationCollection.insertOne({
                        date: interaction.createdAt,
                        user: interaction.user.id,
                        server: interaction.guild.id,
                        expireAt: next,
                        prices: { fuel, co2 },
                        webhooks: []
                    });
                    const messages: APIMessage[] = [];
                    console.log(`A fuel notification was posted by ${interaction.user.id}`);
                    for (const webhook of webhooks) {
                        if ((fuel > webhook.fuel.max || !webhook.fuel.enabled) && (co2 > webhook.co2.max || !webhook.co2.enabled)) continue;
                        const webhookClient = webhookClients.find(webhookClient => webhookClient.id === webhook.id);
                        const guild = interaction.client.guilds.cache.get(webhook.server);
                        const locale = guild?.preferredLocale || "en";
                        let content: string = `${Formatters.roleMention(webhook.role)}, `;
                        if (fuel <= webhook.fuel.max && webhook.fuel.enabled) content += `fuel is ${Formatters.bold(`$${fuel.toLocaleString(locale)}`)}`;
                        if (co2 <= webhook.co2.max && webhook.co2.enabled) {
                            if (content.includes("fuel")) content += " & ";
                            content += `co2 is ${Formatters.bold(`$${co2.toLocaleString(locale)}`)}`;
                        }
                        await webhookClient.send({ content, ...options })
                        .then(message => {
                            if (message) {
                                message.guild_id = webhook.server;
                                messages.push(message);
                            }
                        })
                        .catch(err => console.error("Failed to post a notification:", err));
                    }
                    await notificationCollection.updateOne({ _id: res.insertedId }, {
                        $push: {
                            webhooks: {
                                $each: messages.map(message => ({
                                    id: webhooks.find(webhook => webhook.id === message.webhook_id)._id,
                                    channel: message.channel_id,
                                    server: message.guild_id,
                                    message: message.id
                                }))
                            }
                        }
                    });
                    await interaction.editReply(`Your notifications has been published! To edit your notifications use \`/notification edit\`. To delete it use \`/notification delete\`. The ID of your notification is ${Formatters.bold(res.insertedId.toHexString())}`);
                    await users.updateOne({ id: interaction.user.id }, {
                        $inc: {
                            notifications_made: 1
                        }
                    });
                    break;
                }
                case "edit": {
                    const id = interaction.options.getString("id", true).trim();
                    const notification = await notificationCollection.findOne(ObjectId.isValid(id) ? new ObjectId(id) : { "webhooks.message": id });
                    if (!notification) throw new DiscordClientError("That is not a valid notification ID. Please note that you can only edit notifications from the last 24 hours!");
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && !account?.admin_level) {
                        if (interaction.user.id !== notification.user) throw new DiscordClientError("You can only edit your own notifications!");
                        if (isPast(notification.expireAt)) throw new DiscordClientError("You can only edit notifications during the price period when they were posted!");
                        if (notification.edited) {
                            const difference = Math.abs(differenceInMinutes(interaction.createdAt, notification.edited));
                            if (difference < 5) throw new DiscordClientError("You can only edit your notification once in 5 minutes!");
                        }
                    }
                    const fuel = interaction.options.getInteger("fuel") ?? notification.prices.fuel;
                    const co2 = interaction.options.getInteger("co2") ?? notification.prices.co2;
                    if (fuel === notification.prices.fuel && co2 === notification.prices.co2) throw new DiscordClientError("To edit a notification give either a new fuel/co2 value or both...");
                    await notificationCollection.updateOne({ _id: notification._id }, {
                        $set: {
                            edited: interaction.createdAt,
                            prices: {
                                fuel: fuel,
                                co2: co2
                            }
                        }
                    });
                    for (const channel of notification.webhooks) {
                        const webhook = webhooks.find(webhook => webhook._id.equals(channel.id));
                        const decrypted = CryptoJS.AES.decrypt(webhook.token, process.env.HASH_SECRET);
                        const webhookClient = new WebhookClient({
                            id: webhook.id,
                            token: decrypted.toString(CryptoJS.enc.Utf8)
                        });
                        if ((fuel > webhook.fuel.max || !webhook.fuel.enabled) && (co2 > webhook.co2.max || !webhook.co2.enabled)) {
                            await webhookClient.deleteMessage(channel.message);
                        } else {
                            let content: string = `${Formatters.roleMention(webhook.role)}, `;
                            const guild = interaction.client.guilds.cache.get(webhook.server);
                            const locale = guild?.preferredLocale || "en";
                            if (fuel <= webhook.fuel.max && webhook.fuel.enabled) content += `fuel is ${Formatters.bold(`$${fuel.toLocaleString(locale)}`)}`;
                            if (co2 <= webhook.co2.max && webhook.co2.enabled) {
                                if (content.includes("fuel")) content += " & ";
                                content += `co2 is ${Formatters.bold(`$${co2.toLocaleString(locale)}`)}`;
                            }
                            await webhookClient.editMessage(channel.message, content)
                            .catch(() => undefined);
                        }
                    }
                    console.log(`Notification edited by ${interaction.user.id}`);
                    await interaction.editReply("The notification has been edited!");
                    break;
                }
                case "delete": {
                    const id = interaction.options.getString("id", true).trim();
                    const notification = await notificationCollection.findOne(ObjectId.isValid(id) ? new ObjectId(id) : { "webhooks.message": id });
                    if (!notification) throw new DiscordClientError("That is not a valid notification ID. Please note that you can only delete notifications from the last 24 hours!");
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && !account?.admin_level) {
                        if (interaction.user.id !== notification.user) throw new DiscordClientError("You can only delete your own notifications!");
                        const cooldown = addMinutes(interaction.createdAt, 5);
                        await cooldowns.set(interaction.user.id, cooldown, 5 * 60 * 1000);
                        if (isPast(notification.expireAt)) throw new DiscordClientError("You can only delete notifications during the price period when they were posted!");
                        if (notification.edited) {
                            const difference = Math.abs(differenceInMinutes(interaction.createdAt, notification.edited));
                            if (difference < 5) throw new DiscordClientError("You need to wait 5 minutes after your latest edit to delete your notification!");
                        }
                    }
                    await notificationCollection.deleteOne({ _id: notification._id });
                    for (const channel of notification.webhooks) {
                        const webhook = webhooks.find(webhook => webhook._id.equals(channel.id));
                        const decrypted = CryptoJS.AES.decrypt(webhook.token, process.env.HASH_SECRET);
                        const webhookClient = new WebhookClient({
                            id: webhook.id,
                            token: decrypted.toString(CryptoJS.enc.Utf8)
                        });
                        await webhookClient.deleteMessage(channel.message)
                        .catch(() => undefined);
                    }
                    console.log(`Notification deleted by ${interaction.user.id}`);
                    await interaction.editReply("The notification has been deleted!");
                    if (isFuture(notification.expireAt)) await cooldowns.delete("notification");
                    await users.updateOne({ id: notification.user }, {
                        $inc: {
                            notifications_made: -1
                        }
                    });
                    break;
                }
                case "view": {
                    const id = interaction.options.getString("id", true).trim();
                    const notification = await notificationCollection.findOne(ObjectId.isValid(id) ? new ObjectId(id) : { "webhooks.message": id });
                    if (!notification) throw new DiscordClientError("No notification could be found with that ID. Please note that you can only view notifications from the past 24 hours!");
                    await interaction.client.users.fetch(notification.user)
                    .then(async user => {
                        const userData = await users.findOne({ id: notification.user });
                        const guild = interaction.client.guilds.cache.get(notification.server);
                        const embed = new MessageEmbed({
                            color: "NAVY",
                            description: `Posted with ${notification.webhooks.length} webhooks\n► Posted fuel price as ${Formatters.bold(`$${notification.prices.fuel}`)}\n► Posted co2 price as ${Formatters.bold(`$${notification.prices.co2}`)}`,
                            timestamp: notification.edited || notification.date,
                            author: {
                                name: `${user?.username || "unknown"}#${user?.discriminator || "0000"}`,
                                iconURL: user?.displayAvatarURL() || interaction.client.user.displayAvatarURL()
                            },
                            footer: {
                                text: `Notification ID: ${notification._id}`,
                                iconURL: interaction.client.user.displayAvatarURL()
                            },
                            fields: [
                                {
                                    name: Formatters.bold(Formatters.underscore("Sent from")),
                                    value: `**Server name:** ${guild?.name || "unknown"}\n**Server ID:** ${notification.server}`
                                },
                                {
                                    name: Formatters.bold(Formatters.underscore("Sent by")),
                                    value: `**User ID:** ${notification.user}\n**Airline ID:** ${userData?.airlineID || "unknown"}\n**Notifications made:** ${userData?.notifications_made ?? 0}`
                                }
                            ]
                        });
                        await interaction.editReply({ embeds: [embed] });
                    })
                    .catch(async err => {
                        console.error("Failed to fetch a user:", err);
                        await interaction.editReply("Failed to fetch the user of this notification...");
                    });
                    break;
                }
                case "leaderboard": {
                    const cursor = users.find(
                        { 
                            notifications_made: { 
                                $gt: 0
                            } 
                        },
                        {
                            sort: {
                                notifications_made: -1
                            }
                        }
                    );
                    const amount = await cursor.count();
                    const members = await cursor.limit(10).toArray();
                    const embed = new MessageEmbed({
                        color: "NAVY",
                        title: "Notification Leaderboard",
                        description: members.map((member, i) => `**${i + 1}.** ${member.name || 'unknown'} (${member.notifications_made.toLocaleString(guildLocale)})`).join('\n'),
                        footer: {
                            text: `Total users: ${amount.toLocaleString(guildLocale)}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        }
                    });
                    await interaction.editReply({ embeds: [embed] });
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