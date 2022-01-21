import { Constants, Formatters, Message, MessageSelectMenu, MessageButton, MessageActionRow, type MessageContextMenuInteraction } from 'discord.js';
import DiscordClientError from '../error';
import { emojis } from '../../../config.json';

import type { ContextMenu } from '../types';
import type { Discord } from '@typings/database';
import type { Filter } from 'mongodb';

const command: ContextMenu<MessageContextMenuInteraction> = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 15,
    isAdministrator: false,
    isPublic: true,
    data: {
        name: "Search FAQ",
        type: Constants.ApplicationCommandTypes.MESSAGE,
        defaultPermission: true
    },
    async execute(interaction, { database }) {
        const isMessage = interaction.targetMessage instanceof Message;
        await interaction.deferReply({ ephemeral: isMessage });
        const faqCollection = database.discord.collection<Discord.faq>("FAQ");
        try {
            if (!interaction.targetMessage.content) throw new DiscordClientError(`${isMessage ? Formatters.hyperlink("This message", interaction.targetMessage.url) : "This message"} has no content to search for...`);
            const content = interaction.targetMessage.content.match(/[0-9a-zA-Z'-? ]/g).join("");
            const filter: Filter<Discord.faq> = {
                $text: { $search: content },
                $or: [
                    { public: true },
                    { server: interaction.guildId },
                    { author: { $exists: false } }
                ]
            };
            const cursor = faqCollection.find(filter, {
                sort: { score: { $meta: "textScore" } },
                limit: 25
            });
            if (isMessage) {
                const documents = await cursor.toArray();
                if (!documents.length) throw new DiscordClientError(`No FAQ results could be found with ${Formatters.hyperlink("this", interaction.targetMessage.url)} message...`);
                const selectRow = new MessageActionRow({ 
                    components: [
                        new MessageSelectMenu({
                            customId: "faqSelect",
                            placeholder: "Select the FAQ to send...",
                            options: documents.map((doc, index) => ({
                                label: doc.question,
                                value: doc._id.toHexString(),
                                description: doc.answer.slice(0, 97) + (doc.answer.length > 97 ? "..." : ""),
                                emoji: emojis.help,
                                default: !index
                            }))
                        })
                    ] 
                });
                const buttonRow = new MessageActionRow({
                    components: [
                        new MessageButton({
                            style: "SUCCESS",
                            customId: "confirm",
                            label: "Confirm and send"
                        }),
                        new MessageButton({
                            style: "SUCCESS",
                            customId: "cancel",
                            label: "Cancel"
                        })
                    ]
                });
                let currentDocument = documents[0];
                const reply = await interaction.editReply({
                    content: `${Formatters.bold(currentDocument.question)}\n${currentDocument.answer}`,
                    components: [
                        selectRow,
                        buttonRow
                    ]
                }) as Message;
                const collector = reply.createMessageComponentCollector({ 
                    idle: 3 * 60 * 1000, 
                    max: 9 * 60 * 1000 
                });
                collector.on("collect", async componentInteraction => {
                    if (componentInteraction.isSelectMenu() && componentInteraction.customId === "faqSelect") {
                        const component = <MessageSelectMenu>componentInteraction.component;
                        const [value] = componentInteraction.values;
                        component.options.forEach(option => { 
                            option.default = option.value === value;
                        });
                        selectRow.setComponents(component);
                        currentDocument = documents.find(doc => doc._id.equals(value));
                        await componentInteraction.update({
                            content: `${Formatters.bold(currentDocument.question)}\n${currentDocument.answer}`,
                            components: [
                                selectRow,
                                buttonRow
                            ]
                        });
                    } else if (componentInteraction.isButton()) {
                        await componentInteraction.deferUpdate();
                        collector.stop("selectedValue");
                        if (componentInteraction.customId === "confirm") {
                            await interaction.followUp({
                                content: `${Formatters.italic(`FAQ suggestion for ${Formatters.memberNicknameMention(interaction.targetMessage.author.id)}:`)}\n${Formatters.formatEmoji(emojis.help)} ${Formatters.bold(currentDocument.question + ":")}\n${Formatters.blockQuote(currentDocument.answer)}`,
                                allowedMentions: {
                                    users: [interaction.targetMessage.author.id]
                                }
                            });
                        }
                    }
                });
                collector.once("end", async (collected) => {
                    selectRow.components.forEach(component => component.setDisabled(true));
                    buttonRow.components.forEach(component => component.setDisabled(true));
                    const reply = collected.last() ?? interaction;
                    await reply.editReply({
                        components: [
                            selectRow,
                            buttonRow
                        ]
                    });
                });
            } else {
                const doc = await cursor.tryNext();
                if (!doc) throw new DiscordClientError("No FAQ results could be found with this message...");
                await interaction.editReply({
                    content: `${Formatters.italic(`FAQ suggestion for ${Formatters.memberNicknameMention(interaction.targetMessage.author.id)}:`)}\n${Formatters.formatEmoji(emojis.help)} ${Formatters.bold(doc.question + ":")}\n${Formatters.blockQuote(doc.answer)}`,
                    allowedMentions: {
                        users: [interaction.targetMessage.author.id]
                    }
                });
                const hasNext = await cursor.hasNext();
                if (hasNext) cursor.close();
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