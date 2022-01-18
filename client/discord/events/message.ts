import { MessageActionRow, MessageButton, Formatters, User, type MessageComponentInteraction } from 'discord.js';
import DiscordClientError from '../error';
import config from '../../../config.json';
import { ObjectId } from 'bson';

import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import addSeconds from 'date-fns/addSeconds';
import addMonths from 'date-fns/addMonths';
import isFuture from 'date-fns/isFuture';
import addDays from 'date-fns/addDays';

import type { Discord, AM4_Data } from '@typings/database';
import type { Event } from '../types';

const { prefix } = config;

const requiredLevel = {
    data: 5,
    announce: 4,
    leave: 4,
    suspend: 3,
    warn: 2,
    cooldown: 2
};

const event: Event = {
    name: 'messageCreate',
    once: false,
    async execute(message, { cooldowns, webhook, log, rest, database, client }) {
        if (message.webhookId && [webhook.id, log.id].includes(message.webhookId)) {
            await message.crosspost()
            .then(msg => console.log(`Crossposted webhook announcement: ${msg.webhookId}`))
            .catch(err => console.error("Failed to crosspost webhook announcement:", err));
        } else {
            try {
                if (message.author.bot) return;
                if (message.guild) {
                    const permissions = message.guild.me.permissions;
                    if (!permissions.has("SEND_MESSAGES")) return;
                }
                if (!message.content.startsWith(prefix)) return;
                let args = message.content.replace(/<((@!?\d+)|(:.+?:\d+))>/, "").slice(prefix.length).trim().split(/ +/);
                let command = args.shift().toLowerCase();
                if (command !== "control") return;
                command = args.shift();
                const users = database.discord.collection<Discord.user>('Users');
                const account = await users.findOne({ id: message.author.id });
                const owner = client.application.owner;
                const isDeveloper = owner instanceof User ? (message.author.id === owner.id) : owner.members.some(member => member.id === message.author.id);
                if (!isDeveloper && (!account?.admin_level || (account?.mute && isFuture(account.mute)) || requiredLevel[command] > account?.admin_level)) return;
                const globalCooldown = await cooldowns.get(message.author.id);
                if (globalCooldown) {
                    await message.reply(`You currently have a global cooldown. The cooldown ends ${formatDistanceToNowStrict(new Date(globalCooldown), { addSuffix: true })}`);
                    return;
                }
                if (!args.length) throw new DiscordClientError("You need to specify the action to execute for this command!");
                console.log(`Control command "${command}" was used by ${message.author.username}#${message.author.discriminator}`);
                if (!isDeveloper) {
                    const cooldown = addSeconds(message.createdAt, 60);
                    await cooldowns.set(message.author.id, cooldown, 60 * 1000);
                }
                switch(command) {
                    case "leave": {
                        if (!args.length) throw new DiscordClientError("You need to specify the guild ID!");
                        const [guild_id] = args;
                        if (client.guilds.cache.has(guild_id)) throw new DiscordClientError("Invalid guild ID...");
                        const guild = client.guilds.cache.get(guild_id);
                        await message.reply(`AM4 Bot has been removed from ${Formatters.bold(guild.name)}!`);
                        await guild.leave();
                        break;
                    }
                    case "announce": {
                        if (!args.length) throw new DiscordClientError("You need to specify the announcement content!");
                        const row = new MessageActionRow().addComponents([
                            new MessageButton({
                                label: "Cancel",
                                style: "DANGER",
                                customId: "cancel"
                            }),
                            new MessageButton({
                                label: "Send",
                                style: "SUCCESS",
                                customId: "send"
                            })
                        ]);
                        const reply = await message.reply({
                            content: args.join(" "),
                            components: [row]
                        });
                        const filter = ({ user }: MessageComponentInteraction) => user.id === message.author.id;
                        await reply.awaitMessageComponent({ filter, time: 5 * 60 * 1000 })
                        .then(async component => {
                            for (const button of row.components) button.setDisabled(true);
                            await component.update({ components: [row] });
                            if (component.customId === "cancel") {
                                await component.followUp({
                                    content: "Announcement cancelled...",
                                    ephemeral: true
                                });
                            } else {
                                await webhook.send({
                                    content: component.message.content,
                                    username: message.author.username,
                                    avatarURL: message.author.displayAvatarURL()
                                });
                                await component.followUp({
                                    content: "Announcement published!",
                                    ephemeral: true
                                });
                            }
                        })
                        .catch(async () => await reply.delete());
                        break;
                    }
                    case "warn": {
                        let reason: string, user: User;
                        if (message.mentions.users.size) {
                            if (!args?.length) throw new DiscordClientError("You need to specify the reason for this warning!");
                            reason = args.join(" ");
                            user = message.mentions.users.first();
                        } else {
                            if (args.length < 2) throw new DiscordClientError("You need to specify the user ID and reason for this warning!");
                            const [userId, ...content] = args;
                            reason = content.join(" ");
                            user = await client.users.fetch(userId).catch(() => undefined);
                        }
                        if (!user) throw new DiscordClientError("Invalid user...");
                        const res = await users.findOneAndUpdate(
                            { 
                                id: user.id 
                            }, 
                            {
                                $setOnInsert: {
                                    admin_level: 0,
                                    notifications_made: 0,
                                    commands: []
                                },
                                $push: {
                                    warnings: {
                                        date: message.createdAt,
                                        reason: reason
                                    }
                                }
                            }, 
                            {
                                returnDocument: "after",
                                upsert: true
                            }
                        );
                        if (!res.ok) throw new DiscordClientError("Failed to warn this user...");
                        if (res.value.warnings.length >= 5) {
                            const date = addDays(message.createdAt, 7);
                            await users.updateOne({ id: user.id }, {
                                $set: {
                                    mute: date,
                                    warnings: []
                                }
                            });
                            await user.send(`You have been warned by an AM4 Bot admin for "${reason}". You have received 5 warnings which will result in an one week command mute. You have been suspended from using commands until ${Formatters.time(date, "F")}!`);
                            await message.reply(`${Formatters.bold(`${user.username}#${user.discriminator}`)} has been warned and muted until ${Formatters.time(date, "F")} for reaching 5 warnings!`);
                        } else {
                            await user.send(`You have been warned by an AM4 Bot admin for "${reason}". You currently have ${Formatters.bold(res.value.warnings.length.toString())} warnings. Please note that 5 warnings will result in an one week command mute!`);
                            await message.reply(`${Formatters.bold(`${user.username}#${user.discriminator}`)} has been warned! This user currently has ${Formatters.bold(res.value.warnings.length.toString())} warnings.`);
                        }
                        await log.send(`${Formatters.bold(res?.value?.name || `${user.username}#${user.discriminator}`)} has been warned for "${reason}"`);
                        break;
                    }
                    case "suspend": {
                        let reason: string, user: User, days: number;
                        if (message.mentions.users.size) {
                            if (args?.length < 2) throw new DiscordClientError("You need to specify the amount of days and reason for this suspension!");
                            const [value, ...content] = args;
                            days = parseInt(value);
                            reason = content.join(" ");
                            user = message.mentions.users.first();
                        } else {
                            if (args?.length < 3) throw new DiscordClientError("You need to specify the user ID, amount of days and reason for this suspension!");
                            const [userId, value, ...content] = args;
                            days = parseInt(value);
                            reason = content.join(" ");
                            user = await client.users.fetch(userId).catch(() => undefined);
                        }
                        if (!user) throw new DiscordClientError("Invalid user...");
                        if (isNaN(days)) throw new DiscordClientError("That is an invalid number...");
                        if (!isDeveloper) {
                            if (account.admin_level < 4 && days > 7) throw new DiscordClientError("You need to be level 4 admin to suspend for over 7 days!");
                            if (account.admin_level < 5 && days > 30) throw new DiscordClientError("You need to be level 5 admin to suspend for over 30 days!");
                            if (account.admin_level === 5 && days > 365) throw new DiscordClientError("The maximum suspension is 365 days!");
                        }
                        const date = addDays(message.createdAt, days);
                        const res = await users.findOneAndUpdate(
                            { 
                                id: user.id 
                            }, 
                            {
                                $setOnInsert: {
                                    admin_level: 0,
                                    notifications_made: 0,
                                    commands: [],
                                    warnings: []
                                },
                                $set: {
                                    mute: date
                                }
                            },
                            {
                                returnDocument: "after",
                                upsert: true
                            }
                        );
                        if (!res.ok) throw new DiscordClientError("Failed to suspend this user...");
                        await user.send(`You have been suspended from using command until ${Formatters.time(date, "F")} for "${reason}".`);
                        await message.reply(`${Formatters.bold(`${user.username}#${user.discriminator}`)} has been suspended until ${Formatters.time(date, "F")}!`);
                        await log.send(`${Formatters.bold(res?.value?.name || `${user.username}#${user.discriminator}`)} has been suspended until ${Formatters.time(date, "F")} for "${reason}"`);
                        break;
                    }
                    case "cooldown": {
                        let user: User, seconds: number;
                        if (message.mentions.users.size) {
                            if (!args.length) throw new DiscordClientError("You need to specify the time in seconds for this cooldown!");
                            const [value] = args;
                            seconds = parseInt(value);
                            user = message.mentions.users.first();
                        } else {
                            if (args.length < 2) throw new DiscordClientError("You need to specify the user ID and time in seconds for this cooldown!");
                            const [userId, value] = args;
                            seconds = parseInt(value);
                            user = await client.users.fetch(userId).catch(() => undefined);
                        }
                        if (!user) throw new DiscordClientError("Invalid user...");
                        if (isNaN(seconds)) throw new DiscordClientError("That is an invalid number...");
                        if (seconds > 1000) throw new DiscordClientError("A cooldown cannot be longer than 1000 seconds!");
                        const date = addSeconds(message.createdAt, seconds);
                        await cooldowns.set(user.id, date, seconds * 1000);
                        await message.reply(`A cooldown of ${Formatters.bold(seconds.toLocaleString("en"))} seconds has been set to ${Formatters.bold(`${user.username}#${user.discriminator}`)}.`);
                        break;
                    }
                    case "data": {
                        const allianceCollection = database.am4.collection<AM4_Data.alliance>("Alliances");
                        const memberCollection = database.am4.collection<AM4_Data.member>("Members");
                        if (!args.length) throw new DiscordClientError("You need to specify the database action to execute!");
                        command = args.shift();
                        switch(command) {
                            case "archive": {
                                if (!args.length) throw new DiscordClientError("You need to specify the document ID!");
                                const [object_id] = args;
                                if (!ObjectId.isValid(object_id)) throw new DiscordClientError("That is not a valid document ID...");
                                const res = await allianceCollection.findOneAndUpdate({ _id: new ObjectId(object_id) }, {
                                    $set: {
                                        archived: true
                                    }
                                });
                                if (!res.ok) throw new DiscordClientError("That alliance does not seem to exist in the database...");
                                await message.reply(`Archived ${Formatters.bold(res.value.name)}!`);
                                break;
                            }
                            case "insert": {
                                if (!args.length) throw new DiscordClientError("You need to specify the alliance name!");
                                const { status, alliance, members } = await rest.fetchAlliance(args.join(" "));
                                if (!status.success) throw new DiscordClientError(status.error);
                                const documents = await allianceCollection.countDocuments({ name: alliance.name });
                                if (documents) throw new DiscordClientError("That alliance already exists in the database!");
                                const inserted = await allianceCollection.insertOne({
                                    name: alliance.name,
                                    values: [{
                                        date: message.createdAt,
                                        value: alliance.value
                                    }]
                                });
                                const res = await memberCollection.insertMany(members.map(member => ({
                                    name: member.airline.name,
                                    allianceID: inserted.insertedId,
                                    joined: member.joined,
                                    contribution: member.contribution.total,
                                    flights: member.flights,
                                    dailyContribution: [],
                                    offline: [{ value: 0, date: message.createdAt }],
                                    sv: [{ value: member.sv, date: message.createdAt }],
                                    expireAt: addMonths(message.createdAt, 3)
                                })));
                                await message.reply(`Inserted ${Formatters.bold(alliance.name)} and ${Formatters.bold(res.insertedCount.toLocaleString("en"))} members to the database!`);
                                break;
                            }
                            case "delete": {
                                if (!args.length) throw new DiscordClientError("You need to specify the document ID!");
                                const [object_id] = args;
                                if (!ObjectId.isValid(object_id)) throw new DiscordClientError("That is not a valid document ID...");
                                const res = await allianceCollection.findOneAndDelete({ _id: new ObjectId(object_id) });
                                if (!res.ok) throw new DiscordClientError("No alliance could be found with that ID!");
                                const member_res = await memberCollection.deleteMany({ allianceID: res.value._id });
                                await message.reply(`Deleted the data of ${Formatters.bold(res.value.name)} and it's ${Formatters.bold(member_res.deletedCount.toLocaleString("en"))} members!`);
                                break;
                            }
                            case "update": {
                                if (args.length < 2) throw new DiscordClientError("You need to specify the document ID and the new name of the alliance!");
                                const [object_id, ...content] = args;
                                if (!ObjectId.isValid(object_id)) throw new DiscordClientError("That is not a valid document ID...");
                                const { status, alliance } = await rest.fetchAlliance(content.join(" "));
                                if (!status.success) throw new DiscordClientError(status.error);
                                const res = await allianceCollection.findOneAndUpdate({ _id: new ObjectId(object_id) }, {
                                    $set: {
                                        name: alliance.name
                                    },
                                    $unset: {
                                        archived: ""
                                    }
                                });
                                if (!res.ok) throw new DiscordClientError("No alliance could be found with that ID!");
                                await message.reply(`Updated the name of ${Formatters.bold(res.value.name)} to ${Formatters.bold(alliance.name)}!`);
                                break;
                            }
                        }
                        break;
                    }
                }
            }
            catch(error) {
                if (error instanceof DiscordClientError) {
                    await message.reply(error.toString())
                    .catch(console.error);
                } else {
                    console.error(error);
                    await message.reply("An unknown error occured...")
                    .catch(console.error);
                }
            }
        }
    }
}

export = event;