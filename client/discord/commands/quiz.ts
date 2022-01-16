import { MessageEmbed, Permissions, MessageAttachment, MessageActionRow, MessageButton, Formatters, Constants, type ButtonInteraction, type Message, type TextChannel, type ThreadChannel } from 'discord.js';
import { ObjectId, type Binary, type Filter } from 'mongodb';
import DiscordClientError from '../error';
import config from '../../../config.json';

import type { Quiz, Discord, QuestionDifficulty } from '@typings/database';
import type { SlashCommand } from '../types';

const eventMultiplier = 1;
const modes = {
    easy: 0.5,
    normal: 1,
    hard: 2
};

const addScore = (multiplier: number) => parseFloat((Math.random() * multiplier * eventMultiplier).toFixed(2));
const isLastRound = (index: number, rounds: number) => (index + 1) === rounds;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isPublic: true,
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
        if (ephemeral) return interaction.reply({
            content: "This channel is blacklisted from using commands! Quiz games can only be played in non-blacklisted channels...",
            ephemeral: true
        });
        await interaction.deferReply();
        const games = database.quiz.collection<Quiz.game>('Games');
        const users = database.quiz.collection<Quiz.user>('Users');
        const questionCollection = database.quiz.collection<Quiz.question>('Questions');
        const userCollection = database.discord.collection<Discord.user>("Users");
        try {
            const subCommand = interaction.options.getSubcommand();
            type Difficulty = QuestionDifficulty | "normal";
            switch(subCommand) {
                case "play": {
                    if (!interaction.guild) throw new DiscordClientError("This command requires the bot to be in this server...");
                    const gameId = new ObjectId(interaction.options.getString("game", true).trim());
                    const mode = <Difficulty>(interaction.options.getString("difficulty")?.trim() || "normal");
                    const time = interaction.options.getInteger("time") || 20;
                    const rounds = interaction.options.getInteger("rounds") || 5;
                    const game = await games.findOne(gameId);
                    if (!game) throw new DiscordClientError('That is not a valid game...');
                    const filterQuery: Filter<Quiz.question> = {
                        difficulty: { $in: (mode === "normal" ? ["easy", "hard"] : [mode]) },
                        tags: { $in: [game.tag] }
                    };
                    const poolSize = await questionCollection.countDocuments(filterQuery);
                    const questions = await questionCollection.aggregate<Quiz.question>([
                        {
                            $match: filterQuery
                        },
                        {
                            $sample: {
                                size: rounds
                            }
                        }
                    ]).toArray();
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
                        if (component.customId === "start") {
                            await component.update({ embeds: [embed], components });
                            const has_cooldow = interaction.client.cooldowns.has(interaction.guildId);
                            if (has_cooldow) return component.followUp("Finish the ongoing game before starting a new one!");
                            interaction.client.cooldowns.set(interaction.guildId, null);
                            let thread: ThreadChannel;
                            if (interaction.channel.isThread()) {
                                thread = interaction.channel;
                                if (thread.ownerId === interaction.client.user.id) {
                                    const reason = `Quiz started by ${interaction.user.username}#${interaction.user.discriminator}`;
                                    if (thread.name !== game.name) await thread.setName(game.name, reason);
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
                            const play = async (index: number) => {
                                if (index < questions.length) {
                                    const question = questions[index];
                                    const filter = (res: Message) => question.answers.some(answer => answer.toLowerCase() === res.content.toLowerCase());
                                    const display = new MessageEmbed({ 
                                        color: 0x00AE86,
                                        timestamp: question._id.getTimestamp(),
                                        footer: {
                                            text: `Question ID: ${question._id}`,
                                            iconURL: interaction.client.user.displayAvatarURL()
                                        }
                                    });
                                    let questionMessage: Message;
                                    if (question.type === "image") {
                                        display.setTitle(`${game.base_question} (${index + 1}/${rounds})`);
                                        const attachment = new MessageAttachment((<Binary>question.question).buffer, "question.jpg");
                                        display.setImage('attachment://question.jpg');
                                        questionMessage = await thread.send({
                                            embeds: [display],
                                            files: [attachment]
                                        });
                                    } else {
                                        display.setTitle(`${question.question} (${index + 1}/${rounds})`);
                                        questionMessage = await thread.send({ embeds: [display] });
                                    }
                                    const messages = await thread.awaitMessages({ filter, max: 1, time: time * 1000 });
                                    if (messages.size) {
                                        const msg = messages.first();
                                        if (config.tournament?.enabled) {
                                            const $score = addScore(modes[mode] * game.reward);
                                            const user = await users.findOneAndUpdate(
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
                                            await msg.reply(`That is the correct answer! You now have ${Formatters.bold(user.value.points.toLocaleString(guildLocale))} (+${game.reward * modes[mode]}) points and a score of ${Formatters.bold(user.value.score.toLocaleString(guildLocale))} (+${$score})!`);
                                        } else {
                                            const user = await users.findOneAndUpdate(
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
                                            await msg.reply(`That is the correct answer! You now have ${Formatters.bold(user.value.points.toLocaleString(guildLocale))} (+${game.reward * modes[mode]}) points!`);
                                        }
                                        setTimeout(play, 5000, index + 1);
                                    } else {
                                        let error_message = "Looks like nobody got the right answer this time...";
                                        if (!isLastRound(index, rounds)) error_message += " Next round starts in 5 seconds!";
                                        await questionMessage.reply(error_message);
                                        setTimeout(play, 5000, index + 1);
                                    }
                                } else {
                                    await thread.send("Game ended! To start a new game in this thread use `/quiz play` in this thread. Using the command again in a normal channel will create a new thread.");
                                    interaction.client.cooldowns.delete(interaction.guildId);
                                    await games.updateOne({ _id: gameId }, {
                                        $inc: {
                                            played: 1
                                        }
                                    });
                                    return;
                                }
                            }
                            await thread.send("Game starting in 15 seconds...");
                            setTimeout(play, 15000, 0);
                        } else {
                            await component.update({ embeds: [embed], components });
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
                    const user = await users.findOne({ id: userId });
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
                    const found_users = users.find(type === "score" ? { score: { $exists: true } } : {});
                    const amount = await found_users.count();
                    const quiz_users = await found_users.sort(type === "score" ? { score: -1 } : { points: - 1 }).limit(10).toArray();
                    const quiz_user_data = await userCollection.aggregate<Discord.user>([
                        {
                            $match: {
                                id: { 
                                    $in: quiz_users.map(user => user.id)
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
                        description: quiz_users.map((user, i) => {
                            const username = quiz_user_data.find(u => u.id === user.id)?.name || "unknown";
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