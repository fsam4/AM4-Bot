import { MessageEmbed, Permissions, MessageAttachment, MessageActionRow, MessageButton, Formatters, Constants, type ButtonInteraction, type Message, type TextChannel, type ThreadChannel } from 'discord.js';
import { ObjectId, type Binary, type Filter } from 'mongodb';
import DiscordClientError from '../error';
import { promisify } from 'util';
import config from '../../../config.json';

import type { Quiz, Discord, QuestionDifficulty } from '@typings/database';
import type { SlashCommand } from '@discord/types';

const quizCooldowns = new Set<string>();
const eventMultiplier = 1;
const modes = {
    easy: 0.5,
    normal: 1,
    hard: 2
};

const addScore = (multiplier: number) => parseFloat((Math.random() * multiplier * eventMultiplier).toFixed(2));
const wait = promisify(setTimeout);

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.READ_MESSAGE_HISTORY,
        Permissions.FLAGS.USE_PUBLIC_THREADS,
        Permissions.FLAGS.MANAGE_THREADS,
        Permissions.FLAGS.SEND_MESSAGES,
        Permissions.FLAGS.ATTACH_FILES,
        Permissions.FLAGS.EMBED_LINKS
    ]),
    data: {
        name: 'quiz',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Play and compete in AM4 Bot quiz games',
        defaultPermission: true,
        options: [
            {
                name: 'play',
                description: 'Play quiz games and earn points',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'game',
                        description: 'The quiz game that you want to play',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true,
                        choices: [
                            {
                                name: "Aviation Quiz",
                                value: "609283a37e9f153dd4b179ff"
                            },
                            {
                                name: "Plane Quiz",
                                value: "60927a92495d01598046c4e0"
                            },
                            {
                                name: "Logo Quiz",
                                value: "609280e6615e5c48e0f072e8"
                            },
                            {
                                name: "AM4 Quiz",
                                value: "6092836e453b632458e1521d"
                            },
                            {
                                name: "Airport Quiz",
                                value: "60e5e4c4d6b9af4a969b1eb4"
                            }
                        ]
                    },
                    {
                        name: 'difficulty',
                        description: 'The difficulty level of the quiz. By default normal.',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false,
                        choices: [
                            {
                                name: "Easy",
                                value: "easy"
                            },
                            {
                                name: "Normal",
                                value: "normal"
                            },
                            {
                                name: "Hard",
                                value: "hard"
                            }
                        ]
                    },
                    {
                        name: 'time',
                        description: 'The maximum time to answer in seconds (10-30). By default 20 seconds.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 10,
                        maxValue: 30,
                        required: false
                    },
                    {
                        name: 'rounds',
                        description: 'The amount of rounds in this game (2-15). By default 5 rounds.',
                        type: Constants.ApplicationCommandOptionTypes.INTEGER,
                        minValue: 2,
                        maxValue: 15,
                        required: false
                    }
                ]
            },
            {
                name: 'leaderboard',
                description: 'View leaderboards',
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'type',
                        description: 'The type of leaderboard that you would like to get',
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true,
                        choices: [
                            {
                                name: 'Quiz Points',
                                value: 'points'
                            },
                            {
                                name: 'Monthly Score',
                                value: 'score'
                            }
                        ]
                    }
                ]
            },
            {
                name: 'points',
                description: "Look up your or someone else's points",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: 'user',
                        description: "The user who's points you want to view",
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: false
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, ephemeral, guildLocale, locale }) {
        if (ephemeral) {
            await interaction.reply({
                content: "This channel is blacklisted from using commands! Quiz games can only be played in non-blacklisted channels...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply();
        const games = database.quiz.collection<Quiz.game>('Games');
        const quizUserCollection = database.quiz.collection<Quiz.user>('Users');
        const questionCollection = database.quiz.collection<Quiz.question>('Questions');
        const userCollection = database.discord.collection<Discord.user>("Users");
        try {
            const subCommand = interaction.options.getSubcommand();
            type Difficulty = QuestionDifficulty | "normal";
            switch(subCommand) {
                case "play": {
                    if (!interaction.inCachedGuild()) throw new DiscordClientError("This command can only be used in servers where the bot is in...");
                    const gameId = new ObjectId(interaction.options.getString("game", true).trim());
                    const mode = <Difficulty>(interaction.options.getString("difficulty")?.trim() || "normal");
                    const time = interaction.options.getInteger("time") || 20;
                    const rounds = interaction.options.getInteger("rounds") || 5;
                    const game = await games.findOne(gameId);
                    if (!game) throw new DiscordClientError('That is not a valid game...');
                    const filterQuery: Filter<Quiz.question> = { tags: game.tag };
                    if (mode !== "normal") filterQuery.difficulty = mode;
                    const poolSize = await questionCollection.countDocuments(filterQuery);
                    console.log(`${game.name} was started in ${interaction.guild.name}!`);
                    const embed = new MessageEmbed({
                        title: game.name,
                        color: "ORANGE",
                        timestamp: game._id.getTimestamp(),
                        author: {
                            name: `${interaction.user.username}#${interaction.user.discriminator}`,
                            iconURL: interaction.user.displayAvatarURL()
                        },
                        footer: {
                            text: `Game ID: ${game._id}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        },
                        fields: [
                            { 
                                name: Formatters.underscore("Game info"), 
                                value: `**Made by:** ${game.author}\n**Reward:** ${game.reward * modes[mode]} points\n**Difficulty:** ${mode}\n**Pool of questions:** ${poolSize.toLocaleString(guildLocale)}\n**Played:** ${game.played.toLocaleString(guildLocale)} times`, 
                                inline: false 
                            },
                            { 
                                name: Formatters.underscore("Game settings"), 
                                value: `**Time:** ${Math.round(time)} seconds\n**Questions:** ${Math.round(rounds)}`, 
                                inline: false 
                            }
                        ]
                    });
                    const components = [
                        new MessageActionRow({
                            components: [
                                new MessageButton({
                                    label: "Cancel",
                                    customId: "cancel",
                                    style: "DANGER"
                                }),
                                new MessageButton({
                                    label: "Start game",
                                    customId: "start",
                                    style: "SUCCESS"
                                })
                            ]
                        })
                    ];
                    const message = await interaction.editReply({ embeds: [embed], components }) as Message;
                    const filter = ({ user }: ButtonInteraction) => user.id === interaction.user.id;
                    await message.awaitMessageComponent({ filter, time: 5 * 60 * 1000, componentType: "BUTTON" })
                    .then(async component => {
                        for (const component of components[0].components) component.setDisabled(true);
                        await component.update({ embeds: [embed], components });
                        if (component.customId === "start") {
                            if (quizCooldowns.has(interaction.guildId)) {
                                await component.followUp("Finish the ongoing game before starting a new one!");
                                return;
                            }
                            quizCooldowns.add(interaction.guildId);
                            let thread: ThreadChannel;
                            if (interaction.channel.isThread()) {
                                thread = interaction.channel;
                                if (thread.ownerId === interaction.client.user.id && thread.name !== game.name) {
                                    const reason = `Quiz started by ${interaction.user.username}#${interaction.user.discriminator}`;
                                    await thread.setName(game.name, reason);
                                }
                            } else {
                                thread = await (<TextChannel>interaction.channel).threads.create({
                                    name: game.name,
                                    autoArchiveDuration: 60,
                                    reason: `Quiz started by ${interaction.user.username}#${interaction.user.discriminator}`,
                                    startMessage: <Message>component.message
                                });
                                await thread.members.add(interaction.user, "Started a quiz game");
                            }
                            const cursor = questionCollection.aggregate<Quiz.question>([
                                {
                                    $match: filterQuery
                                },
                                {
                                    $sample: {
                                        size: rounds
                                    }
                                }
                            ]);
                            const closeCursorAndThrowError = (err: string) => {
                                quizCooldowns.delete(interaction.guildId);
                                cursor.close();
                                throw err;
                            }
                            const play = async (round: number) => {
                                const doc = await cursor.tryNext();
                                if (doc) {
                                    const filter = (res: Message) => doc.answers.some(answer => answer.toLowerCase() === res.content.toLowerCase());
                                    const display = new MessageEmbed({ 
                                        color: 0x00AE86,
                                        timestamp: doc._id.getTimestamp(),
                                        footer: {
                                            text: `Question ID: ${doc._id}`,
                                            iconURL: interaction.client.user.displayAvatarURL()
                                        }
                                    });
                                    let questionMessage: Message;
                                    if (doc.type === "image") {
                                        display.setTitle(`${game.base_question} (${round}/${rounds})`);
                                        const attachment = new MessageAttachment((<Binary>doc.question).buffer, "question.jpg");
                                        display.setImage('attachment://question.jpg');
                                        questionMessage = await thread.send({ embeds: [display], files: [attachment] })
                                        .catch(closeCursorAndThrowError);
                                    } else {
                                        display.setTitle(`${doc.question} (${round}/${rounds})`);
                                        questionMessage = await thread.send({ embeds: [display] })
                                        .catch(closeCursorAndThrowError);
                                    }
                                    const messages = await thread.awaitMessages({ filter, max: 1, time: time * 1000 });
                                    if (messages.size) {
                                        const msg = messages.first();
                                        if (config.tournament?.enabled) {
                                            const $score = addScore(modes[mode] * game.reward);
                                            const user = await quizUserCollection.findOneAndUpdate(
                                                { 
                                                    id: msg.author.id 
                                                }, 
                                                {
                                                    $setOnInsert: {
                                                        id: msg.author.id
                                                    },
                                                    $inc: {
                                                        points: game.reward * modes[mode],
                                                        score: $score
                                                    }
                                                }, 
                                                {
                                                    upsert: true,
                                                    returnDocument: "after" 
                                                }
                                            );
                                            let content = `That is the correct answer! You now have ${Formatters.bold(user.value.points.toLocaleString(guildLocale))} (+${game.reward * modes[mode]}) points and a score of ${Formatters.bold(user.value.score.toLocaleString(guildLocale))} (+${$score})!`;
                                            const nextRound = await cursor.hasNext();
                                            if (nextRound) content += " Next round starts in 5 seconds!";
                                            await msg.reply(content)
                                            .catch(closeCursorAndThrowError);
                                        } else {
                                            const user = await quizUserCollection.findOneAndUpdate(
                                                { 
                                                    id: msg.author.id 
                                                }, 
                                                {
                                                    $setOnInsert: {
                                                        id: msg.author.id
                                                    },
                                                    $inc: {
                                                        points: game.reward * modes[mode]
                                                    }
                                                }, 
                                                {
                                                    upsert: true,
                                                    returnDocument: "after" 
                                                }
                                            );
                                            let content = `That is the correct answer! You now have ${Formatters.bold(user.value.points.toLocaleString(guildLocale))} (+${game.reward * modes[mode]}) points!`;
                                            const nextRound = await cursor.hasNext();
                                            if (nextRound) content += " Next round starts in 5 seconds!";
                                            await msg.reply(content)
                                            .catch(closeCursorAndThrowError);
                                        }
                                    } else {
                                        let content = "Looks like nobody got the right answer this time...";
                                        const nextRound = await cursor.hasNext();
                                        if (nextRound) content += " Next round starts in 5 seconds!";
                                        await questionMessage.reply(content)
                                        .catch(closeCursorAndThrowError);
                                    }
                                    await wait(5000);
                                    await play(round + 1);
                                } else {
                                    await thread.send("Game ended! To start a new game in this thread use `/quiz play` in this thread. Using the command again in a normal channel will create a new thread.");
                                    quizCooldowns.delete(interaction.guildId);
                                    await games.updateOne({ _id: gameId }, {
                                        $inc: {
                                            played: 1
                                        }
                                    });
                                    return;
                                }
                            }
                            await thread.send("Game starting in 15 seconds...");
                            await wait(15000);
                            await play(1);
                            const hasNext = await cursor.hasNext();
                            if (hasNext) cursor.close();
                        } else {
                            await interaction.followUp("Game cancelled...");
                        }
                    })
                    .catch(async () => {
                        await interaction.deleteReply();
                    });
                    break;
                }
                case "points": {
                    const userId = interaction.options.getUser("user")?.id || interaction.user.id;
                    const user = await quizUserCollection.findOne({ id: userId });
                    if (!user) throw new DiscordClientError(`${Formatters.userMention(userId)}, does not have any points...`);
                    let content = `**Quiz points:** \`${user.points.toLocaleString(locale)}\``;
                    if (config.tournament?.enabled) content += `\n**Monthly score:** \`${(user.score ?? 0).toLocaleString(locale)}\``;
                    await interaction.editReply(content);
                    break;
                }
                case "leaderboard": {
                    type ScoreType = "points" | "score";
                    const type = <ScoreType>interaction.options.getString("type", true).trim();
                    if (type === "score" && !config.tournament?.enabled) throw new DiscordClientError("There are no ongoing tournaments...");
                    const cursor = quizUserCollection.find(type === "score" && { score: { $exists: true } }, {
                        sort: type === "score" 
                            ? { score: -1 } 
                            : { points: -1 }
                    });
                    const amount = await cursor.count();
                    const users = await cursor.limit(10).toArray();
                    const accounts = await userCollection.aggregate<Discord.user>([
                        {
                            $match: {
                                id: { 
                                    $in: users.map(user => user.id)
                                } 
                            }
                        },
                        {
                            $project: {
                                _id: false,
                                id: true,
                                name: { $ifNull: [ "$name", "unknown" ] }
                            }
                        }
                    ]).toArray();
                    const embed = new MessageEmbed({
                        color: "ORANGE",
                        title: `Leaderboard • ${type === 'score' ? 'Monthly Score' : 'Quiz Points'}`,
                        description: users.map((user, i) => {
                            const username = accounts.find(u => u.id === user.id)?.name || "unknown";
                            return `**${i + 1}.** ${username} • ${Formatters.bold(user[type].toLocaleString(guildLocale))} pts`;
                        }).join('\n'),
                        footer: {
                            text: `Total players: ${amount.toLocaleString(guildLocale)}`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        }
                    });
                    await interaction.editReply({ embeds: [embed] });
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