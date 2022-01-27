import { Formatters, type ButtonInteraction, type GuildMember } from 'discord.js';
import DiscordClientError from '../error';

import type { Component } from '@discord/types';

const component: Component<ButtonInteraction> = {
    name: "role",
    cooldown: 20,
    customId: /role:\d{1,}/,
    async execute(interaction, { parsedCustomId }) {
        if (!interaction.inCachedGuild()) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const [roleId] = parsedCustomId;
            await interaction.guild.roles.fetch(roleId)
            .then(async role => {
                if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("I cannot give you this role as it is higher in the hierarchy than the bot's highest role...");
                if ((<GuildMember>interaction.member).roles.cache.has(roleId)) {
                    await (<GuildMember>interaction.member).roles.remove(role, "Added via role panel");
                    await interaction.editReply(`Removed role ${Formatters.roleMention(roleId)}`);
                } else {
                    await (<GuildMember>interaction.member).roles.add(role, "Removed via role panel");
                    await interaction.editReply(`Added role ${Formatters.roleMention(roleId)}`);
                }
            })
            .catch(async () => {
                await interaction.editReply("Failed to fetch this role from this server...");
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