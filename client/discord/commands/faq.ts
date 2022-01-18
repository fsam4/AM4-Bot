import { Constants, Permissions, Formatters, Team, type ApplicationCommandOptionChoice } from 'discord.js';
import { ObjectId, type Filter } from 'mongodb';
import DiscordClientError from '../error';
import { emojis } from '../../../config.json';

import type { SlashCommand } from '../types';
import type { Discord } from '@typings/database';

const q = /^[0-9a-zA-Z'-]{1,}\?$/g;
const c = /[0-9a-zA-Z'-]/g;

type QuestionType = "custom" | "guild" | "personal" | "am4" | "all";

// This command was never released to AM4 Discord bot and hasn't been debugged

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isPublic: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS
    ]),
    data: {
        name: "faq",
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Search and manage frequently asked questions',
        defaultPermission: true,
        options: [
            {
                name: "search",
                description: "Search for a frequently asked question",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'type',
                        description: 'Whether to search for custom, guild, personal or AM4 questions',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true,
                        choices: [
                            {
                                name: "All FAQs",
                                value: "all"
                            },
                            {
                                name: "All custom made FAQs",
                                value: "custom"
                            },
                            {
                                name: "FAQs made in this server",
                                value: "guild"
                            },
                            {
                                name: "FAQs made by you",
                                value: "personal"
                            },
                            {
                                name: "AM4 FAQs",
                                value: "am4"
                            }
                        ]
                    },
                    {
                        name: 'query',
                        description: 'The question to search for',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        autocomplete: true,
                        required: true
                    },
                    {
                        name: 'target',
                        description: 'The user this search is targeted for if any. Will ping the user.',
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: false
                    }
                ]
            },
            {
                name: "create",
                description: "Create a new frequently asked question",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'question',
                        description: 'The question to create. Can only contain letters, numbers, hyphens, apostrophes and needs to end with a question mark.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'answer',
                        description: 'The answer to the question. Can only contain letters, numbers, hyphens and apostrophes. Max length is 2000 characters.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: 'public',
                        description: 'Whether this is a public question. If set to false will only be searchable in this server or by you in any server.',
                        type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
                        required: true
                    }
                ]
            },
            {
                name: "delete",
                description: "Delete a frequently asked question that is made by you",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'id',
                        description: 'The ID of the question',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, account, locale }) {
        const subCommand = interaction.options.getSubcommand(false);
        await interaction.deferReply({ ephemeral: subCommand !== "search" });
        const faqCollection = database.discord.collection<Discord.faq>("FAQ");
        try {
            switch(subCommand) {
                case "search": {
                    const query = interaction.options.getString("query", true);
                    const filter: Filter<Discord.faq> = ObjectId.isValid(query) ? { _id: new ObjectId(query) } : { question: query };
                    const type = <QuestionType>interaction.options.getString("type", true);
                    switch(type) {
                        case "custom": {
                            filter.author = { $exists: true };
                            if (interaction.inGuild()) {
                                filter.$or = [
                                    { public: true },
                                    { server: interaction.guildId }
                                ];
                            } else {
                                filter.public = true;
                            }
                            break;}
                        case "am4": 
                            filter.author = { $exists: false };
                            break;
                        case "guild": 
                            if (!interaction.inGuild()) throw new DiscordClientError("Server FAQs cannot be searched in DMs!");
                            filter.server = interaction.guildId;
                            break;
                        case "personal":
                            filter.author = interaction.user.id;
                            if (interaction.inGuild()) {
                                filter.$or = [
                                    { public: true },
                                    { server: interaction.guildId }
                                ];
                            } else {
                                filter.public = true;
                            }
                            break;
                        default:
                            filter.$or = [
                                { public: true },
                                { author: { $exists: false } }
                            ];
                    }
                    const doc = await faqCollection.findOne(filter);
                    if (!doc) throw new DiscordClientError("No question could be found with that query...");
                    let content = `${Formatters.formatEmoji(emojis.help)} ${Formatters.bold(doc.question + ":")}\n${Formatters.blockQuote(doc.answer)}`;
                    const target = interaction.options.getUser("target");
                    if (target) content = `${Formatters.italic(`FAQ suggestion for ${Formatters.memberNicknameMention(target.id)}:`)}\n${content}`;
                    await interaction.editReply({
                        content: content,
                        allowedMentions: {
                            users: target ? [target.id] : []
                        }
                    });
                    break;
                }
                case "create": {
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && account.admin_level < 2) {
                        const authorQuestions = await faqCollection.countDocuments({ author: interaction.user.id });
                        if (authorQuestions >= 15) throw new DiscordClientError("You cannot create more than 15 personal questions...");
                    }
                    const question = interaction.options.getString("question", true).trim();
                    if (!q.test(question)) throw new DiscordClientError("Please make sure that your question only contains letters (a-z, uppercase or/and lowercase), numbers, hyphens (-), apostrophes (') and a question mark at the end!");
                    const amount = await faqCollection.countDocuments({ $expr: { $eq: [question.toLowerCase(), { $toLower: "$question" }] } });
                    if (amount) throw new DiscordClientError("This question already exists in the FAQ...");
                    if (question.length > 100) throw new DiscordClientError("A question cannot be longer than 100 characters!");
                    const answer = interaction.options.getString("answer", true).trim();
                    if (!c.test(answer)) throw new DiscordClientError("Please make sure that the answer only contains letters (a-z, uppercase or/and lowercase), numbers, hyphens (-) and apostrophes (')!");
                    if (answer.length > 2000) throw new DiscordClientError(`The answer needs to be less than 2,000 characters! The length of your input was ${answer.length.toLocaleString(locale)}!`);
                    const res = await faqCollection.insertOne({
                        author: interaction.user.id,
                        server: interaction.guildId,
                        question: question,
                        answer: answer,
                        public: interaction.options.getBoolean("public", true)
                    });
                    await interaction.editReply(res.acknowledged ? `Your FAQ was successfully created. It can now be searched up via \`/faq search\`. To delete it use \`/faq delete\`. The ID of your FAQ is ${Formatters.bold(res.insertedId.toString())}, please save this so that you can manage your FAQ later.` : "Something went wrong with creating this FAQ...");
                    break;
                }
                case "delete": {
                    const questionID = interaction.options.getString("id");
                    if (!ObjectId.isValid(questionID)) throw new DiscordClientError("That is not a valid FAQ ID!");
                    const filter: Filter<Discord.faq> = { _id: new ObjectId(questionID), $and: [{ author: { $exists: true } }] };
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && account.admin_level < 2) filter.$and.push({ author: interaction.user.id });
                    const doc = await faqCollection.findOneAndDelete(filter);
                    if (!doc.ok) throw new DiscordClientError("No question of yours could be deleted with that ID...");
                    await interaction.editReply(`${Formatters.italic(doc.value.question)} has been deleted...`);
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
    },
    async autocomplete(interaction, { database }) {
        const faqCollection = database.discord.collection<Discord.faq>("FAQ");
        const focusedValue = <string>interaction.options.getFocused();
        const typeValue = <QuestionType>interaction.options.getString("type");
        try {
            const value = focusedValue.slice(0, 15).match(/(\w|-|\s){1,}/g)?.join("");
            const filter: Filter<Discord.faq> = {
                name: { 
                    $regex: `.*${value}.*`,
                    $options: "i" 
                }
            };
            switch(typeValue) {
                case "custom":
                    filter.author = { $exists: true };
                    if (interaction.inGuild()) {
                        filter.$or = [
                            { public: true },
                            { server: interaction.guildId }
                        ];
                    } else {
                        filter.public = true;
                    }
                    break;
                case "am4":
                    filter.author = { $exists: false };
                    break;
                case "guild":
                    if (interaction.inGuild()) {
                        filter.server = interaction.guildId;
                    } else {
                        await interaction.respond([])
                        .catch(() => undefined);
                        return;
                    }
                    break;
                case "personal":
                    filter.author = interaction.user.id;
                    if (interaction.inGuild()) {
                        filter.$or = [
                            { public: true },
                            { server: interaction.guildId }
                        ];
                    } else {
                        filter.public = true;
                    }
                    break;
                default:
                    filter.$or = [
                        { public: true },
                        { author: { $exists: false } }
                    ];
            }
            const pipeline = [
                {
                    $match: filter
                },
                {
                    $limit: 25
                },
                {
                    $addFields: {
                        name: "$question",
                        value: {
                            $toString: "$_id"
                        }
                    }
                },
                {
                    $project: {
                        _id: false,
                        name: true,
                        value: true
                    }
                }
            ];
            const cursor = faqCollection.aggregate<ApplicationCommandOptionChoice>(pipeline, { maxTimeMS: 2800 });
            const choices = await cursor.toArray();
            await interaction.respond(choices ?? [])
            .catch(() => undefined);
        }
        catch(error) {
            console.error("Error while autocompleting:", error);
            if (!interaction.responded) {
                interaction.respond([])
                .catch(() => undefined);
            };
        }
    }
}

export = command;