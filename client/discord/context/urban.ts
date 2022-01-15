import { MessageEmbed, Formatters, Constants, MessageActionRow, MessageButton, Message, type MessageContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import fetch from 'node-fetch';

import type { ContextMenu } from '../types';

interface Definitions {
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
const replaceHyperlinks = (s: string) => Formatters.hyperlink(s, definitionURL(s));
const hyperlink = /\[\w{1,}\]/g;

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
        name: "Search Urban Dictionary",
        type: Constants.ApplicationCommandTypes.MESSAGE,
        defaultPermission: true
    },
    async execute(interaction, { locale }) {
        await interaction.deferReply();
        try {
            if (interaction.targetMessage instanceof Message) {
                if (!interaction.targetMessage.content) throw new DiscordClientError("This message does not have any text content...");
                const query = new URLSearchParams({ term: interaction.targetMessage.content });
                const { list }: Definitions = await fetch(`https://api.urbandictionary.com/v0/define?${query}`).then((response) => response.json());
                if (!list.length) throw new DiscordClientError(`No results found for ${Formatters.bold(interaction.targetMessage.content)}...`);
                const [answer] = list;
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
                            customId: "thumbs_down",
                            label: answer.thumbs_down.toLocaleString(locale),
                            disabled: true,
                            emoji: "👎"
                        }),
                        new MessageButton({
                            style: "PRIMARY",
                            customId: "thumbs_up",
                            label: answer.thumbs_up.toLocaleString(locale),
                            disabled: true,
                            emoji: "👍"
                        })
                    ]
                });
                await interaction.editReply({ 
                    content: `Searched via ${Formatters.hyperlink("this message", interaction.targetMessage.url)}`,
                    embeds: [embed],
                    components: [row]
                });
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