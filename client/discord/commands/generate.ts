import { Permissions, Constants } from 'discord.js';
import DiscordClientError from '../error';
import fetch from 'node-fetch';

import type { SlashCommand } from '@discord/types';

interface fact {
    id: string;
    text: string;
    source: string;
    source_url: string;
    language: 'en' | 'de';
    permalink: string;
}

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 0,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS
    ]),
    data: {
        name: 'generate',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Generate random jokes or facts',
        defaultPermission: true,
        options: [
            {
                name: "fact",
                description: "Generate a random useless fact",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND
            }
        ]
    },
    async execute(interaction, { ephemeral }) {
        await interaction.deferReply({ ephemeral });
        try {
            const subCommand = interaction.options.getSubcommand();
            switch(subCommand) {
                case "fact": {
                    const fact: fact = await fetch("https://uselessfacts.jsph.pl/random.json?language=en").then(res => res.json());
                    if (!fact) throw new DiscordClientError('Something went wrong with finding a random fact...');
                    await interaction.editReply(fact.text);
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