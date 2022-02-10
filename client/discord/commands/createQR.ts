import { Permissions, MessageAttachment, Constants } from 'discord.js';
import DiscordClientError from '../error';
import { fetch } from 'undici';

import type { SlashCommand } from '@discord/types';

const url = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/;
const hex = /[\#]([a-fA-F\d]{6}|[a-fA-F\d]{3})/gm;
const baseUrl = "https://quickchart.io/qr/create";
const name = /^[a-z]*$/;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 10,
    isGlobal: true,
    isAdministrator: false,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.ATTACH_FILES
    ]),
    data: {
        name: 'createqr',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: 'Create a QR code from a URL',
        defaultPermission: true,
        options: [
            {
                name: 'text',
                description: 'The url that you want this QR-code to include',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: true
            },
            {
                name: 'name',
                description: 'The name of the QR-code file that will be uploaded. Only letters!',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: true
            },
            {
                name: 'format',
                description: 'Image output format (default: PNG)',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
                choices: [
                    {
                        name: 'PNG image',
                        value: 'png'
                    },
                    {
                        name: 'SVG image',
                        value: 'svg'
                    }
                ]
            },
            {
                name: 'dark',
                description: 'The colour of the code (HEX colour code)',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false
            },
            {
                name: 'light',
                description: 'The colour of the background (HEX colour code)',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false
            },
            {
                name: 'size',
                description: 'The size of the image in pixels',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                required: false
            },
            {
                name: 'margin',
                description: 'The whitespace around the code in pixels',
                type: Constants.ApplicationCommandOptionTypes.INTEGER,
                required: false
            },
            {
                name: 'ec_level',
                description: 'Error correction level (default: M)',
                type: Constants.ApplicationCommandOptionTypes.STRING,
                required: false,
                choices: [
                    {
                        name: 'Level L',
                        value: 'L'
                    },
                    {
                        name: 'Level M',
                        value: 'M'
                    },
                    {
                        name: 'Level Q',
                        value: 'Q'
                    },
                    {
                        name: 'Level H',
                        value: 'H'
                    }
                ]
            }
        ]
    },
    async execute(interaction, { ephemeral }) {
        await interaction.deferReply({ ephemeral });
        try {
            const query = new URLSearchParams();
            const fileName = interaction.options.get("name").value as string;
            if (!name.test(fileName)) throw new DiscordClientError("Invalid file name. The QR-code file name can only contain characters!");
            const options = interaction.options.data.filter(({ name }) => name !== "name");
            for (const option of options.values()) {
                const key = option.name.split('_').map((string, index) => index ? string.capitalize() : string).join('');
                if (option.type === "STRING") option.value = (<string>option.value).trim();
                query.append(key, typeof option.value === "string" ? option.value : option.value.toString());
            }
            if (!url.test(query.get("text"))) throw new DiscordClientError('That is not a valid URL...');
            if (query.has("light") && !hex.test(query.get("light"))) throw new DiscordClientError('That is not a valid background colour...');
            if (query.has("dark") && !hex.test(query.get("dark"))) throw new DiscordClientError('That is not a valid QR-code colour...');
            const arrayBuffer = await fetch(`${baseUrl}?${query}`).then(res => res.arrayBuffer());
            const buffer = Buffer.from(new Uint8Array(arrayBuffer));
            const QRcode = new MessageAttachment(buffer, `${fileName}.${query.get("format") || 'png'}`);
            await interaction.editReply({ files: [QRcode] });
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