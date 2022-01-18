import { MessageButton, MessageActionRow, Formatters, type TextChannel } from 'discord.js';
import CryptoJS from 'crypto-js';
import config from '../../../config.json';
import chalk from 'chalk';

import differenceInMilliseconds from 'date-fns/differenceInMilliseconds';
import differenceInHours from 'date-fns/differenceInHours';
import isLastDayOfMonth from 'date-fns/isLastDayOfMonth';
import isFuture from 'date-fns/isFuture';
import isPast from 'date-fns/isPast';

import type { Discord, Quiz } from '@typings/database';
import type { Event } from '../types';

const event: Event = {
    name: 'ready',
    once: true,
    async execute(client, { log, database, timeouts }) {
        const giveawayCollection = database.discord.collection<Discord.giveaway>("Giveaways");
        client.application ||= await client.application.fetch();
        client.user.setStatus("online");
        if (client.user.id === config.clientId) {
            client.user.setPresence({
                activities: [{
                    type: "WATCHING",
                    name: `Used in ${client.guilds.cache.size} servers`
                }]
            });
            if (config.tournament?.enabled && isLastDayOfMonth(Date.now())) {
                const endAt = new Date().setHours(21, 0, 0, 0);
                if (isFuture(endAt)) {
                    console.log(chalk.green("Scheduled tournament rewards for today!"));
                    const ms = Math.abs(differenceInMilliseconds(endAt, Date.now()));
                    setTimeout(async () => {
                        const users = database.quiz.collection<Quiz.user & { name?: string }>('Users');
                        const winnerAmount = config.tournament?.winners || 1;
                        const winners = await users.find({ score: { $exists: true } }).sort({ score: -1 }).limit(winnerAmount).toArray();
                        const codes = Array(winnerAmount).fill(null).map((_, i) => process.env[`TOURNAMENT_CODE_${i + 1}`]);
                        for (let i = 0; i < winnerAmount ; i++) {
                            const code = codes[i];
                            const winner = winners[i];
                            const user = await client.users.fetch(<string>winner.id);
                            await user.send(`Your final rank in this month's tournament was ${Formatters.bold((i + 1).toString())} with a score of ${Formatters.bold(winner.score.toLocaleString('en'))}! Here is your bonus code reward: ${Formatters.spoiler(code)}.`)
                            .then(() => console.log(`Successfully sent code to ${user.username}#${user.discriminator} (${winner.id})!`))
                            .catch(() => console.log(`Failed to send code to ${user.username}#${user.discriminator} (${winner.id})!`));
                        }
                        const [first, second] = winners;
                        await log.send(`${Formatters.bold(`Tournament results for ${client.readyAt.toLocaleString('en', { month: 'long' })}`)}\n🥇 ${first.name || "unknown"}\n🥈 ${second.name || "unknown"}`);
                        await users.updateMany({ score: { $exists: true } }, {
                            $unset: {
                                score: ""
                            }
                        });
                    }, ms);
                }
            }
        }
        const query = client.user.id !== config.clientId && { server: process.env.TEST_GUILD };
        const giveaways = await giveawayCollection.find(query).toArray();
        if (giveaways.length) {
            const triggerGiveaway = async (giveaway: Discord.giveaway) => {
                timeouts.delete(giveaway._id);
                await client.channels.fetch(giveaway.channel)
                .then(async (channel: TextChannel) => {
                    await channel.messages.fetch(giveaway.message)
                    .then(async message => {
                        const [embed] = message.embeds;
                        delete embed.description;
                        const row = new MessageActionRow({
                            components: [
                                new MessageButton({
                                    customId: "giveaway",
                                    label: "Join Giveaway",
                                    style: "SUCCESS",
                                    emoji: "🎉",
                                    disabled: true
                                })
                            ]
                        });
                        await message.edit({ 
                            embeds: [embed],
                            components: [row] 
                        });
                        const updated = await giveawayCollection.findOneAndUpdate({ _id: giveaway._id }, {
                            $set: {
                                finished: true
                            }
                        });
                        if (updated.ok && updated.value) {
                            if (updated.value.users.length) {
                                const winner_id = updated.value.users.random();
                                const reply = await message.reply({
                                    content: `Congratulations ${Formatters.userMention(winner_id)}, you won the giveaway!`,
                                    allowedMentions: {
                                        users: [winner_id],
                                        repliedUser: false
                                    }
                                });
                                await reply.react("🎉");
                                if (updated.value.bonus_code) {
                                    await giveawayCollection.deleteOne({ _id: updated.value._id });
                                    const decrypted = CryptoJS.AES.decrypt(updated.value.bonus_code, process.env.HASH_SECRET);
                                    await client.users.fetch(winner_id)
                                    .then(async user => {
                                        await user.send(`Here is your reward for winning ${Formatters.hyperlink("this", message.url)} giveaway: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`)
                                        .catch(async err => {
                                            console.error("Failed to DM giveaway reward", err);
                                            const author = await client.users.fetch(updated.value.author);
                                            await author.send(`Failed to DM ${Formatters.bold(`${user.username}#${user.discriminator}`)} the reward for winning ${Formatters.hyperlink("this", message.url)} giveaway. Please DM the reward to the user manually: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`)
                                            .catch(() => undefined);
                                        });
                                    })
                                    .catch(async err => {
                                        console.error("Failed to DM giveaway reward", err);
                                        const author = await client.users.fetch(updated.value.author);
                                        await author.send(`Failed to DM the winner of ${Formatters.hyperlink("this", message.url)} giveaway the reward. Please DM the reward to the user manually: ${Formatters.spoiler(decrypted.toString(CryptoJS.enc.Utf8))}`)
                                        .catch(() => undefined);
                                    });
                                }
                            } else {
                                await message.reply("No users participated in this giveaway...");
                            }
                        }
                    })
                    .catch(console.error);
                })
                .catch(console.error);
            }
            for (const giveaway of giveaways) {
                if (giveaway.finished) continue;
                if (isPast(giveaway.expireAt)) {
                    await triggerGiveaway(giveaway);
                } else {
                    const hours = Math.abs(differenceInHours(Date.now(), giveaway.expireAt));
                    if (hours < 48) {
                        const ms = Math.abs(differenceInMilliseconds(Date.now(), giveaway.expireAt));
                        const timeout = setTimeout(triggerGiveaway, ms, giveaway);
                        timeouts.set(giveaway._id, timeout);
                    }
                }
            }
        }
    }
}

export = event;