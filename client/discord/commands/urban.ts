import { MessageEmbed, Permissions, Formatters, Constants, MessageActionRow, MessageButton } from 'discord.js';
import DiscordClientError from '../error';
import fetch from 'node-fetch';

import type { SlashCommand } from '@discord/types';

interface Definition {
    list: Array<{
        definition: string;
        permalink: string;
        thumbs_up: number;
        sound_urls: string[];
        author: string;
        word: string;
        defid: number;
        current_vote: any;
        written_on: Date;
        example: string;
        thumbs_down: number;
    }>
}

const definitionURL = (term: string) => `https://www.urbandictionary.com/define.php?${new URLSearchParams({ term })}`;
const replaceHyperlinks = (s: string) => Formatters.hyperlink(s.replace(/\[|\]/g, ""), definitionURL(s));
const hyperlink = /\[.+\]/g;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS
    ]),
    data: {
        name: 'urban',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Search the urban dictionary',
        defaultPermission: true,
        options: [
            {
                name: 'term',
                description: 'The word/sentence that you want to search for',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: true
            }
        ]
    },
    async execute(interaction, { ephemeral, guildLocale }) {
        await interaction.deferReply({ ephemeral });
        try {
            const term = interaction.options.getString("term");
            const query = new URLSearchParams({ term });
            const definition: Definition = await fetch(`https://api.urbandictionary.com/v0/define?${query}`).then(response => response.json());
            if (definition || !definition.list?.length) throw new DiscordClientError(`No results found for ${Formatters.bold(term)}...`);
            const [answer] = definition.list;
            answer.definition = answer.definition.replace(hyperlink, replaceHyperlinks);
            answer.example = answer.example.replace(hyperlink, replaceHyperlinks);
            const embed = new MessageEmbed({
                color: "DARK_GOLD",
                title: answer.word,
                url: answer.permalink,
                timestamp: answer.written_on,
                fields: [
                    { 
                        name: "Definition", 
                        value: answer.definition.trim() || "\u200b"
                    },
                    { 
                        name: "Example", 
                        value: Formatters.italic(answer.example.trim()) || "\u200b"
                    }
                ]
            });
            const row = new MessageActionRow({
                components: [
                    new MessageButton({
                        style: "PRIMARY",
                        customId: "thumbs_up",
                        label: answer.thumbs_up.toLocaleString(guildLocale),
                        disabled: true,
                        emoji: "👍"
                    }),
                    new MessageButton({
                        style: "PRIMARY",
                        customId: "thumbs_down",
                        label: answer.thumbs_down.toLocaleString(guildLocale),
                        disabled: true,
                        emoji: "👎"
                    })
                ]
            });
            await interaction.editReply({ 
                embeds: [embed],
                components: [row]
            });
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