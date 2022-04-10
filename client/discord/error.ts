import ClientError from '../error';

import type { MessageComponentInteraction, CommandInteraction, ContextMenuInteraction } from 'discord.js';

type Interaction = MessageComponentInteraction | CommandInteraction | ContextMenuInteraction;

/**
 * A class representing a Discord client error.
 * @constructor
 * @param message - The error message
 */

 export default class DiscordClientError extends ClientError {

    public constructor(message: string) {
        super(message);
    }

    /**
     * Send the error as an interaction response
     * @param interaction - The interaction to reply to
     */

    async send(interaction: Interaction) {
        if (interaction.replied) {
            await interaction.followUp(this.message)
            .catch(console.error);
        } else if (interaction.deferred) {
            await interaction.editReply(this.message)
            .catch(console.error);
        } else {
            await interaction.reply(this.message)
            .catch(console.error);
        }
    }

    /**
     * Send an unknown error reply to an interaction
     * @param interaction - The interaction to reply to
     */

    static async sendUnknownError(interaction: Interaction) {
        const inviteUrl = process.env.DISCORD_SERVER_INVITE;
        if (inviteUrl === undefined) throw new Error("DISCORD_SERVER_INVITE must be provided!");
        const message = `An unknown error occured. Please report this in ${inviteUrl}.`;
        if (interaction.replied) {
            await interaction.followUp(message)
            .catch(console.error);
        } else if (interaction.deferred) {
            await interaction.editReply(message)
            .catch(console.error);
        } else {
            await interaction.reply(message)
            .catch(console.error);
        }
    }

}