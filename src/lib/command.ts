import type { ApplicationCommandData, ApplicationCommandOptionData } from 'discord.js';

interface ApplicationCommandOption {
    type: number;
	name: string;
	description: string;
	required?: boolean;
    min_value?: number;
    max_value?: number;
    options?: this[];
    channel_types?: number[];
    autocomplete?: boolean;
	choices?: Array<{
		name: string;
		value: string | number;
	}>;
}

type Constructable<T> = void | T;

/**
 * A function that can be called as a function or with `new` keyword. Constructs `ApplicationCommandOptionData` to raw API data.
 * @param option The `ApplicationCommandOptionData` of the option
 * @returns The raw API data, if not called with `new` keyword
 */

function ApplicationCommandOption(this: ApplicationCommandOption, option: ApplicationCommandOptionData): Constructable<ApplicationCommandOption> {
    const matchFunction = (match: string) => `_${match.toLowerCase()}`;
    if (new.target) {
        Object.keys(option).forEach(key => {
            if (key === "options") {
                this[key] = option[key].map(ApplicationCommandOption);
            } else {
                const thisKey = key.replace(/[A-Z]/g, matchFunction);
                this[thisKey] = option[key];
            }
        });
    } else {
        // Declared as partial to declare an empty object
        const optionBody: Partial<ApplicationCommandOption> = {};
        Object.keys(option).forEach(key => {
            if (key === "options") {
                this[key] = option[key].map(ApplicationCommandOption);
            } else {
                const thisKey = key.replace(/[A-Z]/g, matchFunction);
                this[thisKey] = option[key];
            }
        });
        // Casted as ApplicationCommandOption as optionBody is not partial anymore
        return optionBody as ApplicationCommandOption;
    }
}

/**
 * A class that constructs `ApplicationCommandData` to raw API data.
 * @constructor 
 * @param command The `ApplicationCommandData` of the command
 */

export default class ApplicationCommand {
	public name: string;
	public description?: string;
	public options?: ApplicationCommandOption[];
	public default_permission?: boolean;
	public type?: number;
    constructor(command: ApplicationCommandData) {
        command.type ||= 1;
        this.name = command.name;
        this.type = <number>command.type;
        this.default_permission = command.defaultPermission;
        if (command.type === "CHAT_INPUT" || command.type === 1) {
            this.description = command.description;
            // @ts-ignore: ApplicationCommandOption will return the correct value when called as a function
            if ("options" in command) this.options = command.options.map(ApplicationCommandOption);
        }
    }
}