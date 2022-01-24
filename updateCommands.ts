import ApplicationCommand from './src/lib/command';
import dotenvExpand from 'dotenv-expand';
import { Routes } from 'discord-api-types/v9';
import { REST } from '@discordjs/rest';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

import type { SlashCommand, ContextMenu } from '@discord/types';

interface APIApplicationCommand extends ApplicationCommand {
	id: string;
	application_id: string;
	guild_id?: string;
	version: string;
}

const chatCommandFiles = fs.readdirSync('./client/discord/commands').filter(file => file.endsWith('.js'));
const menuCommandFiles = fs.readdirSync('./client/discord/context').filter(file => file.endsWith('.js'));

const commands: ApplicationCommand[] = [];
const isDev = process.argv.includes("--dev");

console.log(`Deploying ${isDev ? "developement" : "main"} commands...`);
const env = dotenv.config({ path: isDev ? ".env.local" : ".env" });
dotenvExpand(env);

const clientId = process.env.CLIENT_ID;
if (clientId === undefined) throw new Error("CLIENT_ID must be provided!");

const botToken = process.env.DISCORD_BOT_TOKEN;
if (botToken === undefined) throw new Error("DISCORD_BOT_TOKEN must be provided!");
const rest = new REST({ version: '9' }).setToken(botToken);

void async function () {

	for (const file of chatCommandFiles) {
		const command: SlashCommand = await import(`./client/discord/commands/${file}`);
		if (isDev && !command.data.defaultPermission) command.data.defaultPermission = true;
		if (!isDev && !command.isGlobal) continue;
		const commandData = new ApplicationCommand(command.data);
		commands.push(commandData);
	}

	for (const file of menuCommandFiles) {
		const command: ContextMenu = await import(`./client/discord/context/${file}`);
		if (isDev && !command.data.defaultPermission) command.data.defaultPermission = true;
		if (!command.isGlobal) continue;
		const commandData = new ApplicationCommand(command.data);
		commands.push(commandData);
	}

	try {
		console.log('Started refreshing application commands...');
		let fullRoute: `/${string}`;
		if (isDev) {
			const guildId = process.env.TEST_GUILD_ID;
			if (guildId === undefined) throw new Error("TEST_GUILD_ID must be provided!");
			fullRoute = Routes.applicationGuildCommands(clientId, guildId);
		} else {
			fullRoute = Routes.applicationCommands(clientId);
		}
		const applicationCommands = await rest.put(fullRoute, { body: commands }) as APIApplicationCommand[];
		console.log(chalk.green('Successfully reloaded application commands.'));
		console.table(
			applicationCommands.map(command => ({
				"Command Name": command.name,
				"Command ID": command.id,
				"Version": command.version
			}))
		);
	} 
	catch (error) {
		console.error(chalk.red("Failed to reload application commands:"), error);
	}

}();