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
        name: "View Giveaway",
        type: Constants.ApplicationCommandTypes.MESSAGE,
        defaultPermission: true
    },
    async execute(interaction, { database, locale }) {
        if (!interaction.inGuild()) {
            await interaction.reply("This command can only be used in servers...");
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const giveaways = database.discord.collection<Discord.giveaway>("Giveaways");
            if (interaction.targetMessage.author.id !== interaction.client.user.id) throw new DiscordClientError("This command can only be used on giveaways created by AM4 Bot...");
            const isMessage = interaction.targetMessage instanceof Message;
            const giveaway = await giveaways.findOne({ message: interaction.targetId });
            if (!giveaway) throw new DiscordClientError(`${isMessage ? Formatters.hyperlink("This message", interaction.targetMessage.url) : "This message"} does not seem to be an _active_ giveaway created by AM4 Bot...`);
            const embed = new MessageEmbed({
                color: "FUCHSIA",
                description: `**Giveaway ends:** ${Formatters.time(giveaway.expireAt, "R")}\n**Total participants:** ${giveaway.users.length.toLocaleString(locale)}\n**Message ID:** ${interaction.targetMessage.id}`,
                author: {
                    name: `${interaction.user.username}#${interaction.user.discriminator}`,
                    iconURL: interaction.user.displayAvatarURL()
                },
                footer: {
                    text: `Giveaway ID: ${giveaway._id}`,
                    iconURL: interaction.client.user.displayAvatarURL()
                }
            });
            if (isMessage) embed.author.url = interaction.targetMessage.url;
            if (giveaway.users.length) {
                giveaway.users = giveaway.users.slice(0, 120);
                const chunks = Math.ceil(giveaway.users.length / 15);
                const mentions = giveaway.users.map(Formatters.memberNicknameMention).split(chunks);
                const fields = mentions.map((content, i) => ({
                    name: i ? "\u200b" : "Participants",
                    value: content.join("\n"),
                    inline: false
                }));
                embed.setFields(fields);
            } else {
                embed.setFields({
                    name: "Participants",
                    value: "\u200b",
                    inline: false
                });
            }
            await interaction.editReply({ embeds: [embed] });
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