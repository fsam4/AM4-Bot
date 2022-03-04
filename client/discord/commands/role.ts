import { MessageEmbed, Permissions, MessageActionRow, MessageButton, Util, Formatters, Constants, Team, type TextChannel, type Role, type MessageButtonStyleResolvable, type GuildMember } from 'discord.js';
import DiscordClientError from '../error';
import unicodeEmoji from '../../../src/lib/unicodeEmoji';
import { ObjectId } from 'bson';

import type { SlashCommand } from '@discord/types';
import type { Discord } from '@typings/database';

const customEmoji =  /<?(a)?:?(\w{2,32}):(\d{17,19})>?/g;

const command: SlashCommand = {
    get name() {
        return this.data.name;
    },
    set name(value) {
        this.data.name = value;
    },
    cooldown: 30,
    isGlobal: true,
    isAdministrator: true,
    permissions: new Permissions([
        Permissions.FLAGS.USE_APPLICATION_COMMANDS,
        Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
        Permissions.FLAGS.ATTACH_FILES,
        Permissions.FLAGS.SEND_MESSAGES,
        Permissions.FLAGS.EMBED_LINKS,
        Permissions.FLAGS.MANAGE_ROLES,
        Permissions.FLAGS.ADD_REACTIONS,
        Permissions.FLAGS.MANAGE_MESSAGES
    ]),
    data: {
        name: 'role',
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
        description: "Manage a member's roles and create role panels",
        defaultPermission: false,
        options: [
            {
                name: "add",
                description: "Add a new role to a member",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "user",
                        description: "The user whom to add the role to",
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: true
                    },
                    {
                        name: "role",
                        description: "The role to add to this user.",
                        type: Constants.ApplicationCommandOptionTypes.ROLE,
                        required: true
                    },
                    {
                        name: "reason",
                        description: "The reason for this action",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: "remove",
                description: "Remove a role from a member",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "user",
                        description: "The user whom to remove the role from",
                        type: Constants.ApplicationCommandOptionTypes.USER,
                        required: true
                    },
                    {
                        name: "role",
                        description: "The role to add to this user.",
                        type: Constants.ApplicationCommandOptionTypes.ROLE,
                        required: true
                    },
                    {
                        name: "reason",
                        description: "The reason for this action",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: false
                    }
                ]
            },
            {
                name: "reaction",
                description: "Create a reaction role message from your own message",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                options: [
                    {
                        name: "message",
                        description: "The ID of the message to add the reaction to.",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: "emoji",
                        description: "The emoji to react with.",
                        type: Constants.ApplicationCommandOptionTypes.STRING,
                        required: true
                    },
                    {
                        name: "role",
                        description: "The role to obtain from the reaction.",
                        type: Constants.ApplicationCommandOptionTypes.ROLE,
                        required: true
                    },
                    {
                        name: "channel",
                        description: "The channel where the message is located in. By default the current channel.",
                        type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                        channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                        required: true
                    },
                ]
            },
            {
                name: "panel",
                description: "Manage role panels",
                type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                options: [
                    {
                        name: "create",
                        description: "Create a new role panel",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "name",
                                description: "The name of the panel (max 256 characters). Will appear as the embed title.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "description",
                                description: "The description of the panel (max 4096 characters).",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "channel",
                                description: "The channel where to send this panel to. By default the current channel.",
                                type: Constants.ApplicationCommandOptionTypes.CHANNEL,
                                channelTypes: [Constants.ChannelTypes.GUILD_TEXT],
                                required: false
                            }
                        ]
                    },
                    {
                        name: "close",
                        description: "Close a new role panel",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "id",
                                description: "The ID of the panel or the message ID of the panel message.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            }
                        ]
                    },
                    {
                        name: "add",
                        description: "Add a new role button to a role panel",
                        type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
                        options: [
                            {
                                name: "id",
                                description: "The ID of the panel or the message ID of the panel message.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "role",
                                description: "The role that can be obtained via this button.",
                                type: Constants.ApplicationCommandOptionTypes.ROLE,
                                required: true
                            },
                            {
                                name: "emoji",
                                description: "The emoji of this role.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: true
                            },
                            {
                                name: "label",
                                description: "The label of the button (max 80 characters).",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false
                            },
                            {
                                name: "style",
                                description: "The style of the button.",
                                type: Constants.ApplicationCommandOptionTypes.STRING,
                                required: false,
                                choices: [
                                    {
                                        name: "Blurple",
                                        value: "PRIMARY"
                                    },
                                    {
                                        name: "Green",
                                        value: "SUCCESS"
                                    },
                                    {
                                        name: "Red",
                                        value: "DANGER"
                                    },
                                    {
                                        name: "Gray",
                                        value: "SECONDARY"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    async execute(interaction, { database, account }) {
        if (!interaction.inGuild() as boolean) {
            await interaction.reply("This command can only be used in servers...");
            return;
        } else if (!interaction.inCachedGuild()) {
            await interaction.reply({
                content: "This command can only be used in servers where the bot is in...",
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const panels = database.discord.collection<Discord.Panel>("Panels");
            const subCommand = interaction.options.getSubcommand(false);
            const group = interaction.options.getSubcommandGroup(false);
            switch(group || subCommand) {
                case "add": {
                    const member = <GuildMember>interaction.options.getMember("user", true);
                    const role = <Role>interaction.options.getRole("role", true);
                    if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("I cannot manage roles higher than the my highest role.");
                    const reason = interaction.options.getString("reason")?.trimEnd();
                    await member.roles.add(role, reason || `Role added by ${interaction.user.username}#${interaction.user.discriminator}`);
                    await interaction.editReply({
                        content: `${Formatters.roleMention(role.id)} has been added to ${Formatters.memberNicknameMention(member.id)}!`,
                        allowedMentions: {
                            users: [],
                            roles: []
                        }
                    });
                    break;
                }
                case "remove": {
                    const member = <GuildMember>interaction.options.getMember("user", true);
                    const role = <Role>interaction.options.getRole("role", true);
                    if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("I cannot manage roles higher than the my highest role.");
                    const reason = interaction.options.getString("reason")?.trimEnd();
                    await member.roles.remove(role, reason || `Role removed by ${interaction.user.username}#${interaction.user.discriminator}`);
                    await interaction.editReply({
                        content: `${Formatters.roleMention(role.id)} has been removed from ${Formatters.memberNicknameMention(member.id)}!`,
                        allowedMentions: {
                            users: [],
                            roles: []
                        }
                    });
                    break;
                }
                case "reaction": {
                    const owner = interaction.client.application.owner;
                    const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                    if (!isDeveloper && (!account || account.admin_level < 2)) {
                        const amount = await panels.countDocuments({ type: "message", author: interaction.user.id });
                        if (amount > 5) throw new DiscordClientError("A single user can at maximum have 5 reaction role messages at a time!");
                    }
                    const message_id = interaction.options.getString("message", true).trim();
                    const channel = <TextChannel>(interaction.options.getChannel("channel") || interaction.channel);
                    if (!channel.isText()) throw new DiscordClientError("Reaction role messages can only be created in text channels...");
                    await channel.messages.fetch(message_id)
                    .then(async message => {
                        if (message.author.id !== interaction.user.id) throw new DiscordClientError("You can only make reaction roles out of your own messages!");
                        const role = <Role>interaction.options.getRole("role", true);
                        if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("I cannot manage roles higher than the my highest role.");
                        const emojiResolvable = interaction.options.getString("emoji", true).trimEnd();
                        if (!customEmoji.test(emojiResolvable) && !unicodeEmoji.test(emojiResolvable)) throw new DiscordClientError("That is not a valid emoji...");
                        await message.react(emojiResolvable)
                        .then(async () => {
                            const parsedEmoji = Util.parseEmoji(emojiResolvable);
                            await panels.updateOne(
                                { 
                                    message: message.id, 
                                    type: "message" 
                                }, 
                                {
                                    $setOnInsert: {
                                        author: message.author.id,
                                        server: message.guild.id,
                                        channel: message.channel.id,
                                    },
                                    $addToSet: {
                                        reactions: {
                                            role: role.id,
                                            emoji: {
                                                name: parsedEmoji.name,
                                                id: parsedEmoji.id
                                            }
                                        }
                                    }
                                }, 
                                { 
                                    upsert: true 
                                }
                            );
                            await interaction.editReply({
                                content: `Your ${Formatters.hyperlink("message", message.url)} has now been turned in to a reaction role message. Any users reacting to this message will receive ${role} role. Removing the reaction will remove the role. Remove the bot's reaction from the message or delete your message to close this reaction role message.`,
                                allowedMentions: {
                                    roles: []
                                }
                            });
                        })
                        .catch(async err => {
                            console.error("Failed to react to a message:", err);
                            await interaction.editReply(`Failed to react to ${Formatters.hyperlink("this", message.url)} message!`);
                        });
                    })
                    .catch(async err => {
                        console.error("Failed to fetch message:", err);
                        await interaction.editReply("Failed to fetch a message with that ID from this channel...");
                    });
                    break;
                }
                case "panel": {
                    switch(subCommand) {
                        case "create": {
                            const owner = interaction.client.application.owner;
                            const isDeveloper = owner instanceof Team ? owner.members.some(member => member.id === interaction.user.id) : (interaction.user.id === owner.id);
                            if (!isDeveloper && (!account || account.admin_level < 2)) {
                                const amount = await panels.countDocuments({ type: "panel", server: interaction.guildId });
                                if (amount > 10) throw new DiscordClientError("A server cannot have more than 10 active role panels at a time!");
                            }
                            const name = interaction.options.getString("name", true).trimEnd();
                            const description = interaction.options.getString("description", true).trimEnd();
                            if (name.length > 256) throw new DiscordClientError(`The maximum size of the name is 256 characters! The size of your input is ${name.length} characters.`);
                            if (description.length > 4096) throw new DiscordClientError(`The maximum size of the description is 4096 characters! The size of your input is ${description.length} characters.`);
                            const channel = <TextChannel>(interaction.options.getChannel("channel") || interaction.channel);
                            if (!channel.isText()) throw new DiscordClientError("Role panels can only be deployed to text channels!");
                            const embed = new MessageEmbed({
                                color: "ORANGE",
                                title: name,
                                description: description,
                                author: {
                                    name: `${interaction.user.username}#${interaction.user.discriminator}`,
                                    iconURL: interaction.user.displayAvatarURL()
                                },
                                fields: [{
                                    name: Formatters.underscore("Roles"),
                                    value: "\u200b",
                                    inline: false
                                }]
                            });
                            const permissions = channel.permissionsFor(interaction.guild.me);
                            const missing = permissions.missing([
                                Permissions.FLAGS.SEND_MESSAGES,
                                Permissions.FLAGS.EMBED_LINKS
                            ]);
                            if (missing.length) throw new DiscordClientError(`The bot does not have the permission to send messages and use embeds in ${Formatters.channelMention(channel.id)}!`);
                            await channel.send({ embeds: [embed] })
                            .then(async message => {
                                const res = await panels.insertOne({
                                    type: "panel",
                                    author: interaction.user.id,
                                    server: interaction.guildId,
                                    channel: message.channel.id,
                                    message: message.id
                                });
                                await interaction.editReply(`Your role panel has been deployed in ${Formatters.channelMention(channel.id)}! You can find it ${Formatters.hyperlink("here", message.url)}. To add buttons to the panel use ${Formatters.inlineCode("/role panel add_button")}. To close the panel either delete the message or use ${Formatters.inlineCode("/role panel close")}. The ID of the role panel is ${Formatters.bold(res.insertedId.toHexString())}.`)
                            })
                            .catch(async err => {
                                console.error("Failed to deploy role panel:", err);
                                await interaction.editReply(`Failed to deploy this role panel to ${Formatters.channelMention(channel.id)}...`);
                            });
                            break;
                        }
                        case "close": {
                            const id = interaction.options.getString("id", true).trim();
                            const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { message: id };
                            const res = await panels.findOneAndDelete({ 
                                ...query, 
                                author: interaction.user.id, 
                                server: interaction.guildId,
                                type: "panel" 
                            });
                            if (!res.ok) throw new DiscordClientError("Could not find an active role panel from this server created by you with that ID...");
                            await interaction.guild.channels.fetch(res.value.channel)
                            .then(async (channel: TextChannel) => {
                                await channel.messages.fetch(res.value.message)
                                .then(async message => {
                                    for (const row of message.components) {
                                        for (const component of row.components) {
                                            component.setDisabled(true);
                                        }
                                    }
                                    await message.edit({ components: message.components });
                                    await interaction.editReply(`The role pannel in ${Formatters.hyperlink("here", message.url)} has been closed. The panel cannot be used to obtain roles anymore.`);
                                })
                                .catch(async err => {
                                    console.error("Failed to fetch role panel message:", err);
                                    await interaction.editReply("Failed to fetch the message of this role panel. This means that the buttons will not be disabled, but please note that the pannel will still not respond anymore as it has been closed.");
                                });
                            })
                            .catch(async err => {
                                console.error("Failed to fetch role panel channel:", err);
                                await interaction.editReply("Failed to fetch the channel of this role panel. This means that the buttons will not be disabled, but please note that the pannel will still not respond anymore as it has been closed.");
                            });
                            break;
                        }
                        case "add": {
                            const id = interaction.options.getString("id", true).trim();
                            const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { message: id };
                            const panel = await panels.findOne({
                                ...query, 
                                author: interaction.user.id, 
                                server: interaction.guildId,
                                type: "panel" 
                            });
                            if (!panel) throw new DiscordClientError("Could not find an active role panel from this server created by you with that ID...");
                            const button = new MessageButton({
                                style: "PRIMARY",
                                customId: undefined
                            });
                            const role = interaction.options.getRole("role", true);
                            if (role.position > interaction.guild.me.roles.highest.position) throw new DiscordClientError("You cannot add roles that are higher in the hierarchy than the bot's highest role!");
                            button.setCustomId(`role:${role.id}`);
                            const emojiResolvable = interaction.options.getString("emoji", true).trim();
                            button.setEmoji(emojiResolvable);
                            const label = interaction.options.getString("label")?.trimEnd();
                            if (label) {
                                if (label.length > 80) throw new DiscordClientError("A button label can at maximum be 80 characters!");
                                button.setLabel(label);
                            }
                            const style = <MessageButtonStyleResolvable>interaction.options.getString("style")?.trim();
                            if (style) button.setStyle(style);
                            await interaction.guild.channels.fetch(panel.channel)
                            .then(async (channel: TextChannel) => {
                                await channel.messages.fetch(panel.message)
                                .then(async message => {
                                    if (!message?.components?.length) {
                                        message.embeds[0].fields[0].value = "";
                                        const row = new MessageActionRow();
                                        message.components = [row];
                                    }
                                    const { components: rows, embeds: [embed] } = message;
                                    if (rows.last().components.length === 5 && rows.length === 5) throw new DiscordClientError("You cannot add anymore role buttons to this panel! Create a new one to add more buttons...");
                                    if (rows.last().components.length < 5) {
                                        rows.last().addComponents(button);
                                    } else {
                                        const row = new MessageActionRow({ components: [button] });
                                        rows.push(row);
                                    }
                                    if (embed.fields[0].value.length) embed.fields[0].value += "\n";
                                    embed.fields[0].value += `${emojiResolvable} ► ${role}`;
                                    await message.edit({
                                        embeds: [embed],
                                        components: rows
                                    });
                                    await interaction.editReply({
                                        content: `Added ${Formatters.roleMention(role.id)} to ${Formatters.hyperlink("this", message.url)} panel!`,
                                        allowedMentions: {
                                            roles: []
                                        }
                                    });
                                })
                                .catch(async err => {
                                    console.error("Failed to fetch role panel message:", err);
                                    await interaction.editReply("Failed to fetch the message of this role panel. This means that the buttons will not be disabled, but please note that the pannel will still not respond anymore as it has been closed.");
                                });
                            })
                            .catch(async err => {
                                console.error("Failed to fetch role panel channel:", err);
                                await interaction.editReply("Failed to fetch the channel of this role panel. This means that the buttons will not be disabled, but please note that the pannel will still not respond anymore as it has been closed.");
                            });
                            break;
                        }
                    }
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