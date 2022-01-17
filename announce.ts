import updateContent from './documents/json/update.json';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import dotenv from 'dotenv';
import chalk from 'chalk';

const isTest = process.argv.includes("--test");

dotenv.config({ path: isTest ? ".env.local" : ".env" });

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

void async function () {
    try {
        console.log("Sending announcement...");
        const fullRoute = isTest 
            ? Routes.channelMessages(process.env.TEST_CHANNEL) 
            : Routes.webhook(process.env.ANNOUNCEMENT_WEBHOOK_ID, process.env.ANNOUNCEMENT_WEBHOOK_TOKEN);
        const body = { embeds: updateContent };
        await rest.post(fullRoute, { body });
        console.log(chalk.green("Succesfully sent announcement!"));
    }
    catch (error) {
        console.error(chalk.red("Failed to send announcement:"), error);
    }
}();