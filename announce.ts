import updateEmbed from './documents/json/update.json';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import dotenv from 'dotenv';
import chalk from 'chalk';

const isTest = process.argv.includes("--test");

dotenv.config({ path: isTest ? ".env.local" : ".env" });

const botToken = process.env.DISCORD_BOT_TOKEN;
if (botToken === undefined) throw new Error("DISCORD_BOT_TOKEN must be provided!");
const rest = new REST({ version: '9' }).setToken(botToken);

void async function () {
    try {
        console.log("Sending announcement...");
        let fullRoute: `/${string}`;
        if (isTest) {
            const channelId = process.env.TEST_CHANNEL_ID;
            if (channelId === undefined) throw new Error("TEST_CHANNEL_ID must be provided!");
            fullRoute = Routes.channelMessages(channelId);
        } else {
            const webhookId = process.env.ANNOUNCEMENT_WEBHOOK_ID;
            if (webhookId === undefined) throw new Error("ANNOUNCEMENT_WEBHOOK_ID must be provided!");
            const webhookToken = process.env.ANNOUNCEMENT_WEBHOOK_TOKEN;
            if (webhookToken === undefined) throw new Error("ANNOUNCEMENT_WEBHOOK_TOKEN must be provided!");
            fullRoute = Routes.webhook(webhookId, webhookToken);
        }
        const body = { embeds: [updateEmbed] };
        await rest.post(fullRoute, { body });
        console.log(chalk.green("Succesfully sent announcement!"));
    }
    catch (error) {
        console.error(chalk.red("Failed to send announcement:"), error);
    }
}();