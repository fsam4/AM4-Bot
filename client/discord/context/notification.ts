import { MessageEmbed, Formatters, Constants, Message, type MessageContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';

import type { ContextMenu } from '../types';
import type { Discord } from '@typings/database';

const systemWebhooks = [
    process.env.ANNOUNCEMENT_WEBHOOK_ID,
    process.env.LOG_WEBHOOK_ID
];

const command: ContextMenu<MessageContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 5,
    isAdministrator: false,
    isPublic: true,
    data: {
        name: "View Notification",
        type: Constants.ApplicationCommandTypes.MESSAGE,
        defaultPermission: true
    },
    async execute(interaction, { database, locale }) {
        if (interaction.channel.type === "DM") return interaction.reply("This command can only be used in servers...");
        if (!interaction.guild) return interaction.reply("This command requires the bot to be in this server...");
        await interaction.deferReply({ ephemeral: true });
        const users = database.discord.collection<Discord.user>("Users");
        const notifications = database.discord.collection<Discord.notification>("Notifications");
        try {
            if (interaction.targetMessage instanceof Message) {
                if (!interaction.targetMessage.webhookId) throw new DiscordClientError("This command can only be used on notification messages sent by AM4 Bot notification webhooks!");
                if (systemWebhooks.includes(interaction.targetMessage.webhookId)) throw new DiscordClientError("This command cannot be used on AM4 Bot system webhooks!");
                await interaction.targetMessage.fetchWebhook()
                .then(async webhook => {
                    if (webhook.owner.id !== interaction.client.user.id) throw new DiscordClientError("This command can only be used on notification messages sent by AM4 Bot notification webhooks!");
                    const notification = await notifications.findOne({ 'webhooks.message': interaction.targetId });
                    if (!notification) throw new DiscordClientError(`${Formatters.hyperlink("This notification message", (<Message>interaction.targetMessage).url)} has expired. Expired notification messages cannot be viewed. Notification messages expire 24 hours after they have been sent.`);
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
                                url: (<Message>interaction.targetMessage).url
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
                        await interaction.editReply(`Failed to fetch the user of ${Formatters.hyperlink("this", (<Message>interaction.targetMessage).url)} notification...`);
                    });
                })
                .catch(async err => {
                    console.error("Failed to fetch webhook:", err);
                    await interaction.editReply(`Failed to fetch the webhook of ${Formatters.hyperlink("this", (<Message>interaction.targetMessage).url)} notification...`);
                })
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