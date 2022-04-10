import { MessageEmbed, Formatters, Constants, Message, type MessageContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';

import type { ContextMenu } from '@discord/types';
import type { Discord } from '@typings/database';

const command: ContextMenu<MessageContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 5,
    isAdministrator: false,
    isGlobal: true,
    data: {
        name: "View Notification",
        type: Constants.ApplicationCommandTypes.MESSAGE,
        defaultPermission: true
    },
    async execute(interaction, { database, locale, log, webhook }) {
        if (!interaction.inGuild() as boolean) {
            await interaction.reply("This command can only be used in servers...");
            return;
        } else if (!interaction.inCachedGuild()) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const users = database.discord.collection<Discord.User>("Users");
            const notifications = database.discord.collection<Discord.Notification>("Notifications");
            if (interaction.targetMessage instanceof Message) {
                const systemWebhooks = [log.id, webhook.id];
                if (!interaction.targetMessage.webhookId) throw new DiscordClientError(`This command can only be used on notification messages sent by ${interaction.client.user.username} notification webhooks!`);
                if (systemWebhooks.includes(interaction.targetMessage.webhookId)) throw new DiscordClientError(`This command cannot be used on ${interaction.client.user.username} system webhooks!`);
                await interaction.targetMessage.fetchWebhook()
                .then(async webhook => {
                    if (webhook.owner.id !== interaction.client.user.id) throw new DiscordClientError(`This command can only be used on notification messages sent by ${interaction.client.user.username} notification webhooks!`);
                    const notification = await notifications.findOne({ 'webhooks.message': interaction.targetId });
                    if (!notification) throw new DiscordClientError(`${Formatters.hyperlink("This notification message", interaction.targetMessage.url)} has expired. Expired notification messages cannot be viewed. Notification messages expire 24 hours after they have been sent.`);
                    await interaction.client.users.fetch(notification.user)
                    .then(async user => {
                        const userData = await users.findOne({ id: notification.user });
                        const guild = interaction.client.guilds.cache.get(notification.server);
                        const embed = new MessageEmbed({
                            color: "NAVY",
                            description: `Posted with ${notification.webhooks.length.toLocaleString(locale)} webhooks\n► Posted fuel price as ${Formatters.bold(`$${notification.prices.fuel.toLocaleString(locale)}`)}\n► Posted co2 price as ${Formatters.bold(`$${notification.prices.co2.toLocaleString(locale)}`)}`,
                            timestamp: notification.edited || notification.date,
                            author: {
                                name: `${user?.username || "unknown"}#${user?.discriminator || "0000"}`,
                                iconURL: user?.displayAvatarURL() || interaction.client.user.displayAvatarURL(),
                                url: interaction.targetMessage.url
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
                                    value: `**User ID:** ${notification.user}\n**Airline ID:** ${userData.airlineID || "unknown"}\n**Notifications made:** ${userData.notifications_made}`
                                }
                            ]
                        });
                        await interaction.editReply({ embeds: [embed] });
                    })
                    .catch(async err => {
                        console.error("Failed to fetch a user:", err);
                        await interaction.editReply(`Failed to fetch the user of ${Formatters.hyperlink("this", interaction.targetMessage.url)} notification...`);
                    });
                })
                .catch(async err => {
                    console.error("Failed to fetch webhook:", err);
                    await interaction.editReply(`Failed to fetch the webhook of ${Formatters.hyperlink("this", interaction.targetMessage.url)} notification...`);
                })
            } else {
                await interaction.editReply("Unable to fetch this message's webhook...");
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