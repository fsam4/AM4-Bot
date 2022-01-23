import './global.ts';

// * Importing clients & main modules
import Discord, { type ClientEvents } from 'discord.js';
import { Scenes, session, Telegraf } from 'telegraf';
import { EventEmitter } from 'events';
import { MongoClient } from 'mongodb';
import AM4RestClient from './src/index';
import dotenvExpand from 'dotenv-expand';
import QuickLRU from 'quick-lru';
import cluster from 'cluster';
import dotenv from 'dotenv';
import chalk from 'chalk';
import Keyv from 'keyv';
import fs from 'fs';

// * Importing date methods
import formatDistanceToNowStrict from 'date-fns/formatDistanceToNowStrict';
import differenceInMilliseconds from 'date-fns/differenceInMilliseconds';
import addSeconds from 'date-fns/addSeconds';
import addDays from 'date-fns/addDays';
import isPast from 'date-fns/isPast';

// * Importing types
import type * as TelegramClientTypes from '@telegram/types';
import type * as DiscordClientTypes from '@discord/types';
import type * as ClientTypes from '@client/types';
import type { BotCommand } from 'typegram';
import type * as Database from '@typings/database';

process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));

const isDev = process.argv.includes("--dev");
const rest = new AM4RestClient({
    accessToken: {
        am4: process.env.API_KEY,
        tools: process.env.TOOLS_KEY
    }
});

const isJavaScript = (fileName: string) => fileName.endsWith('.js');

if (cluster.isPrimary) {

    // The main cluster, responsible for listening to general events and managing the other clusters

    console.log(chalk.bold(`Using Node.js ${process.version}`));
    let env = dotenv.config({ path: isDev ? ".env.local" : ".env" });
    env = dotenvExpand(env);
    const discordWorker = cluster.fork(env.parsed);
    const telegramWorker = cluster.fork(env.parsed);

    let discordDisconnectTimeout: NodeJS.Timeout, telegramDisconnectTimeout: NodeJS.Timeout;

    const disconnectWorkers = () => {
        if (discordWorker.isConnected() && !discordWorker.isDead() && !discordDisconnectTimeout) {
            discordWorker.send("shutdown");
            discordWorker.disconnect();
            discordDisconnectTimeout = setTimeout(() => discordWorker.kill(), 2500);
        }
        if (telegramWorker.isConnected() && !telegramWorker.isDead() && !telegramDisconnectTimeout) {
            telegramWorker.send("shutdown");
            telegramWorker.disconnect();
            telegramDisconnectTimeout = setTimeout(() => telegramWorker.kill(), 2500);
        }
    };

    discordWorker.on("disconnect", () => discordDisconnectTimeout && clearTimeout(discordDisconnectTimeout));
    telegramWorker.on("disconnect", () => telegramDisconnectTimeout && clearTimeout(telegramDisconnectTimeout));

    process.on("disconnect", disconnectWorkers);
    process.once("SIGTERM", disconnectWorkers);
    process.once("exit", disconnectWorkers);

    if (!isDev) {

        const options = { discordWorker, telegramWorker };
        const events = new EventEmitter({ captureRejections: true });
        fs.readdir("./client/events", async (err, files) => {
            if (err) throw err;
            files = files.filter(isJavaScript);
            for (const file of files) {
                const event: ClientTypes.Event = await import(`./client/events/${file}`);
                if (event.once) {
                    events.once(event.name, event.execute);
                } else {
                    events.on(event.name, event.execute);
                }
            }
            let updateAt: number | Date = new Date().setHours(12, 0, 0, 0);
            if (isPast(updateAt)) updateAt = addDays(updateAt, 1);
            const ms = Math.abs(differenceInMilliseconds(updateAt, Date.now()));
            setTimeout(() => events.emit("dataUpdate", rest, options), ms);
            console.log(chalk.green(`Scheduled next data update to ${new Date(updateAt)}`));
        });

        process.on("message", message => {
            if (typeof message !== "string") return;
            const eventNames = events.eventNames();
            if (eventNames.includes(message)) {
                events.emit(message, rest, options);
            } else {
                console.log(`Primary received unknown message: ${message}`);
            }
        });

    }

} else if (cluster.isWorker) {

    const db = new MongoClient(process.env.DATABASE_URL);
    const cooldowns = new Keyv(process.env.DATABASE_SECONDARY_URL, { namespace: 'cooldowns' });
    cooldowns.on('error', err => console.error('Keyv connection error:', err));

    switch (cluster.worker.id) {
        case 1: {

            // The cluster responsible for running & managing the Discord client

            const label = chalk.blue('Starting Discord client');
            console.time(label);

            const menuCommandFiles = fs.readdirSync("./client/discord/context").filter(isJavaScript);
            const chatCommandFiles = fs.readdirSync("./client/discord/commands").filter(isJavaScript);
            const componentFiles = fs.readdirSync("./client/discord/components").filter(isJavaScript);
            const eventFiles = fs.readdirSync("./client/discord/events").filter(isJavaScript);

            const intents = new Discord.Intents([
                Discord.Intents.FLAGS.GUILDS,
                Discord.Intents.FLAGS.GUILD_MESSAGES,
                Discord.Intents.FLAGS.GUILD_WEBHOOKS,
                Discord.Intents.FLAGS.DIRECT_MESSAGES,
                Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
            ]);

            if (!isDev) intents.add(Discord.Intents.FLAGS.GUILD_MEMBERS);
            const partials: Discord.PartialTypes[] = ['MESSAGE', 'CHANNEL', 'USER', 'GUILD_MEMBER', 'REACTION'];
            const client = new Discord.Client({ partials, intents, allowedMentions: { users: [] } });
            client.on("rateLimit", rateLimit => console.log(chalk.red("Discord rate limit:"), rateLimit));
            if (isDev) {
                client.on("debug", message => console.log(chalk.italic(message)));
                client.on("warn", message => console.log(chalk.red(message)));
            }

            db.connect(async (err, database) => {

                if (err) throw err;

                const options: DiscordClientTypes.BaseOptions = {
                    client, rest, cooldowns,
                    timeouts: new Map(),
                    telegramWorker: cluster.workers[2],
                    webhook: new Discord.WebhookClient({
                        id: process.env.ANNOUNCEMENT_WEBHOOK_ID,
                        token: process.env.ANNOUNCEMENT_WEBHOOK_TOKEN
                    }),
                    log: new Discord.WebhookClient({
                        id: process.env.LOG_WEBHOOK_ID,
                        token: process.env.LOG_WEBHOOK_TOKEN
                    }),
                    database: {
                        am4: database.db("AM4-Data"),
                        quiz: database.db("Quiz"),
                        discord: database.db("Discord"),
                        settings: database.db("Settings"),
                        telegram: database.db("Telegram")
                    }
                };

                for (const file of chatCommandFiles) {
                    const command: DiscordClientTypes.SlashCommand = await import(`./client/discord/commands/${file}`);
                    client.chatCommands.set(command.name, command);
                }

                for (const file of menuCommandFiles) {
                    const command: DiscordClientTypes.ContextMenu = await import(`./client/discord/context/${file}`);
                    client.menuCommands.set(command.name, command);
                }

                for (const file of componentFiles) {
                    const component: DiscordClientTypes.Component = await import(`./client/discord/components/${file}`);
                    client.components.set(component.name, component);
                }

                for (const file of eventFiles) {
                    type DiscordEvent = DiscordClientTypes.EventHandler<keyof ClientEvents>;
                    const event: DiscordEvent = await import(`./client/discord/events/${file}`);
                    if (event.once) {
                        client.once(event.name, async (...args) => event.execute(...args, options));
                    } else {
                        client.on(event.name, async (...args) => event.execute(...args, options));
                    }
                }

                console.timeLog(label);
                await client.login(process.env.BOT_TOKEN);
                console.timeEnd(label);

            });

            process.on("message", message => {
                if (typeof message !== "string") return;
                switch (message) {
                    case "shutdown": {
                        console.log(chalk.red("Disconnected from Discord cluster..."));
                        if (client.isReady()) client.destroy();
                        db.close(true);
                        break;
                    }
                    default: {
                        console.log(`Discord worker received unknown message: ${message}`);
                        break;
                    }
                }
            });

            cluster.worker.once("exit", (code, signal) => {
                let message: string;
                if (signal) {
                    message = chalk.red(`Discord worker was killed by signal: ${signal}`);
                } else if (code != 0) {
                    message = chalk.red(`Discord worker exited with error code: ${code}`);
                } else {
                    message = chalk.green("Discord worker success");
                }
                console.log(message);
                if (client.isReady()) client.destroy();
                db.close(true);
            });

            break;
        }
        case 2: {

            // The cluster responsible for running & managing the Telegram client

            const label = chalk.blue('Starting Telegram client');
            console.time(label);

            const commandFiles = fs.readdirSync("./client/telegram/commands").filter(isJavaScript);
            const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
            const lru = new QuickLRU({ maxSize: 200 });
            const keyv = new Keyv({ store: lru });

            keyv.on('error', err => console.error('Keyv connection error:', err));

            db.connect(async (err, database) => {

                if (err) throw err;

                const commands: BotCommand[] = [];
                const options: TelegramClientTypes.BaseOptions = {
                    cooldowns, bot, rest, keyv,
                    discordWorker: cluster.workers[1],
                    timeouts: new Map(),
                    database: {
                        am4: database.db("AM4-Data"),
                        quiz: database.db("Quiz"),
                        discord: database.db("Discord"),
                        settings: database.db("Settings"),
                        telegram: database.db("Telegram")
                    }
                };

                const stage = new Scenes.Stage([], { ttl: 600000 });
                for (const file of commandFiles) {
                    const command: TelegramClientTypes.Command = await import(`./client/telegram/commands/${file}`);
                    for (const scene of command.scenes) {
                        await scene.register(options);
                        // @ts-expect-error: custom scene context type
                        stage.register(scene.scene);
                    }
                }

                // ! session is deprecated, may break in any of telegraf's major releases

                bot.use(session());
                bot.use(stage.middleware());
                bot.catch(err => console.error("Telegram Error:", err));

                for await (const file of commandFiles) {
                    const command: TelegramClientTypes.Command = await import(`./client/telegram/commands/${file}`);
                    commands.push({
                        command: command.name,
                        description: command.description
                    });
                    bot.command(command.name, async (ctx) => {
                        const users = database.db('Telegram').collection<Database.Telegram.user>('Users');
                        const user = await users.findOne({ id: ctx.from.id });
                        if (user && !user.admin_level) {
                            const cooldown = await cooldowns.get(ctx.from.id.toString());
                            if (cooldown) {
                                await ctx.reply(`Your cooldown ends ${formatDistanceToNowStrict(new Date(cooldown), { addSuffix: true })}`)
                                .then(msg => {
                                    setTimeout(() => {
                                        ctx.deleteMessage(msg.message_id)
                                        .catch(() => undefined);
                                    }, 10000);
                                });
                                return;
                            } else if (command.cooldown) {
                                const timeout = addSeconds(ctx.message.date * 1000, command.cooldown);
                                await cooldowns.set(ctx.from.id.toString(), timeout, command.cooldown * 1000);
                            }
                        }
                        await command.execute(ctx, { ...options, account: user })
                        if (!user) {
                            await users.insertOne({
                                id: ctx.from.id,
                                airline_id: null,
                                admin_level: 0,
                                commands: [{ command: command.name, uses: 1 }],
                            });
                        } else {
                            if (!user.commands.some(({ command: command_name }) => command_name === command.name)) {
                                await users.updateOne({ id: ctx.from.id }, {
                                    $push: {
                                        commands: {
                                            command: command.name,
                                            uses: 1
                                        }
                                    }
                                });
                            } else {
                                await users.updateOne({ id: ctx.from.id }, 
                                    {
                                        $inc: {
                                            "commands.$[element].uses": 1
                                        }
                                    }, 
                                    {
                                        upsert: true,
                                        arrayFilters: [{ "element.command": command.name }]
                                    }
                                );
                            }
                        }
                    });
                    // @ts-expect-error: context types will be correct at runtime
                    for (const action of command.actions) bot.action(action.value, ctx => action.execute(ctx, options));
                }

                console.timeLog(label);
                await bot.launch();
                await bot.telegram.setMyCommands(commands);
                console.timeEnd(label);

            });

            process.on("message", message => {
                if (typeof message !== "string") return;
                switch(message) {
                    case "shutdown": {
                        console.log(chalk.red("Disconnected from Discord cluster..."));
                        db.close(true);
                        bot.stop();
                        break;
                    }
                    default: {
                        console.log(`Telegram worker received unknown message: ${message}`);
                        break;
                    }
                }
            });

            cluster.worker.once("exit", (code, signal) => {
                let message: string;
                if (signal) {
                    message = chalk.red(`Telegram worker was killed by signal: ${signal}`);
                } else if (code != 0) {
                    message = chalk.red(`Telegram worker exited with error code: ${code}`);
                } else {
                    message = chalk.green("Telegram worker success");
                }
                console.log(message);
                db.close(true);
                bot.stop();
            });

            break;

        }

    };

}

