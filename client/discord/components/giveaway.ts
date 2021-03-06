import { Formatters, type ButtonInteraction, type Message } from 'discord.js';
import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import DiscordClientError from '../error';

import type { Component } from '@discord/types';
import type { Discord } from '@typings/database';

const component: Component<ButtonInteraction> = {
    name: "giveaway",
    cooldown: 5,
    customId: /giveaway/,
    async execute(interaction, { database, guildLocale }) {
        if (!interaction.inCachedGuild()) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferUpdate();
        try {
            const giveaways = database.discord.collection<Discord.Giveaway>("Giveaways");
            let giveaway = await giveaways.findOne({ message: interaction.message.id });
            if (interaction.user.id === giveaway.author) throw new DiscordClientError("You cannot join your own giveaway...");
            if (giveaway.users.includes(interaction.user.id)) throw new DiscordClientError("You have already joined this giveaway...");
            const res = await giveaways.findOneAndUpdate({ _id: giveaway._id }, { $addToSet: { users: interaction.user.id } }, { returnDocument: "after" });
            if (!res.ok) throw new DiscordClientError("Failed to join this giveaway, please try again...");
            giveaway = res.value;
            const [embed] = interaction.message.embeds;
            embed.setFooter({
                text: `Total participants: ${giveaway.users.length.toLocaleString(guildLocale)}`, 
                iconURL: interaction.user.displayAvatarURL()
            });
            await interaction.editReply({ embeds: [embed] });
            await interaction.followUp({
                content: `You have joined ${Formatters.hyperlink("this", interaction.message.url)} giveaway! The giveaway will end ${formatDistanceToNowStrict(giveaway.expireAt, { addSuffix: true })}.`,
                ephemeral: true
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