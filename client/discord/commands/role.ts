import { MessageEmbed, Permissions, MessageActionRow, MessageButton, Util, Formatters, Constants, Team, type TextChannel, type Role, type MessageButtonStyleResolvable, type GuildMember } from 'discord.js';
import DiscordClientError from '../error';
import { ObjectId } from 'bson';

import type { SlashCommand } from '../types';
import type { Discord } from '@typings/database';

const unicodeEmoji = /(?:\ud83d\udc68\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c\udffb|\ud83d\udc68\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc]|\ud83d\udc68\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd]|\ud83d\udc68\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffc-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffd-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c\udffb|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb\udffc]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd\udfff]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffd]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffe]|\ud83e\uddd1\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c\udffb|\ud83e\uddd1\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb\udffc]|\ud83e\uddd1\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udffd]|\ud83e\uddd1\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udffe]|\ud83e\uddd1\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\u200d\ud83e\udd1d\u200d\ud83e\uddd1|\ud83d\udc6b\ud83c[\udffb-\udfff]|\ud83d\udc6c\ud83c[\udffb-\udfff]|\ud83d\udc6d\ud83c[\udffb-\udfff]|\ud83d[\udc6b-\udc6d])|(?:\ud83d[\udc68\udc69])(?:\ud83c[\udffb-\udfff])?\u200d(?:\u2695\ufe0f|\u2696\ufe0f|\u2708\ufe0f|\ud83c[\udf3e\udf73\udf93\udfa4\udfa8\udfeb\udfed]|\ud83d[\udcbb\udcbc\udd27\udd2c\ude80\ude92]|\ud83e[\uddaf-\uddb3\uddbc\uddbd])|(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75]|\u26f9)((?:\ud83c[\udffb-\udfff]|\ufe0f)\u200d[\u2640\u2642]\ufe0f)|(?:\ud83c[\udfc3\udfc4\udfca]|\ud83d[\udc6e\udc71\udc73\udc77\udc81\udc82\udc86\udc87\ude45-\ude47\ude4b\ude4d\ude4e\udea3\udeb4-\udeb6]|\ud83e[\udd26\udd35\udd37-\udd39\udd3d\udd3e\uddb8\uddb9\uddcd-\uddcf\uddd6-\udddd])(?:\ud83c[\udffb-\udfff])?\u200d[\u2640\u2642]\ufe0f|(?:\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\ud83c\udff4\u200d\u2620\ufe0f|\ud83d\udc15\u200d\ud83e\uddba|\ud83d\udc41\u200d\ud83d\udde8|\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83e\uddde\u200d\u2640\ufe0f|\ud83e\uddde\u200d\u2642\ufe0f|\ud83e\udddf\u200d\u2640\ufe0f|\ud83e\udddf\u200d\u2642\ufe0f)|[#*0-9]\ufe0f?\u20e3|(?:[©®\u2122\u265f]\ufe0f)|(?:\ud83c[\udc04\udd70\udd71\udd7e\udd7f\ude02\ude1a\ude2f\ude37\udf21\udf24-\udf2c\udf36\udf7d\udf96\udf97\udf99-\udf9b\udf9e\udf9f\udfcd\udfce\udfd4-\udfdf\udff3\udff5\udff7]|\ud83d[\udc3f\udc41\udcfd\udd49\udd4a\udd6f\udd70\udd73\udd76-\udd79\udd87\udd8a-\udd8d\udda5\udda8\uddb1\uddb2\uddbc\uddc2-\uddc4\uddd1-\uddd3\udddc-\uddde\udde1\udde3\udde8\uddef\uddf3\uddfa\udecb\udecd-\udecf\udee0-\udee5\udee9\udef0\udef3]|[\u203c\u2049\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267b\u267f\u2692-\u2697\u2699\u269b\u269c\u26a0\u26a1\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f8\u26fa\u26fd\u2702\u2708\u2709\u270f\u2712\u2714\u2716\u271d\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u2764\u27a1\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299])(?:\ufe0f|(?!\ufe0e))|(?:(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75\udd90]|[\u261d\u26f7\u26f9\u270c\u270d])(?:\ufe0f|(?!\ufe0e))|(?:\ud83c[\udf85\udfc2-\udfc4\udfc7\udfca]|\ud83d[\udc42\udc43\udc46-\udc50\udc66-\udc69\udc6e\udc70-\udc78\udc7c\udc81-\udc83\udc85-\udc87\udcaa\udd7a\udd95\udd96\ude45-\ude47\ude4b-\ude4f\udea3\udeb4-\udeb6\udec0\udecc]|\ud83e[\udd0f\udd18-\udd1c\udd1e\udd1f\udd26\udd30-\udd39\udd3d\udd3e\uddb5\uddb6\uddb8\uddb9\uddbb\uddcd-\uddcf\uddd1-\udddd]|[\u270a\u270b]))(?:\ud83c[\udffb-\udfff])?|(?:\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc6c\udb40\udc73\udb40\udc7f|\ud83c\udde6\ud83c[\udde8-\uddec\uddee\uddf1\uddf2\uddf4\uddf6-\uddfa\uddfc\uddfd\uddff]|\ud83c\udde7\ud83c[\udde6\udde7\udde9-\uddef\uddf1-\uddf4\uddf6-\uddf9\uddfb\uddfc\uddfe\uddff]|\ud83c\udde8\ud83c[\udde6\udde8\udde9\uddeb-\uddee\uddf0-\uddf5\uddf7\uddfa-\uddff]|\ud83c\udde9\ud83c[\uddea\uddec\uddef\uddf0\uddf2\uddf4\uddff]|\ud83c\uddea\ud83c[\udde6\udde8\uddea\uddec\udded\uddf7-\uddfa]|\ud83c\uddeb\ud83c[\uddee-\uddf0\uddf2\uddf4\uddf7]|\ud83c\uddec\ud83c[\udde6\udde7\udde9-\uddee\uddf1-\uddf3\uddf5-\uddfa\uddfc\uddfe]|\ud83c\udded\ud83c[\uddf0\uddf2\uddf3\uddf7\uddf9\uddfa]|\ud83c\uddee\ud83c[\udde8-\uddea\uddf1-\uddf4\uddf6-\uddf9]|\ud83c\uddef\ud83c[\uddea\uddf2\uddf4\uddf5]|\ud83c\uddf0\ud83c[\uddea\uddec-\uddee\uddf2\uddf3\uddf5\uddf7\uddfc\uddfe\uddff]|\ud83c\uddf1\ud83c[\udde6-\udde8\uddee\uddf0\uddf7-\uddfb\uddfe]|\ud83c\uddf2\ud83c[\udde6\udde8-\udded\uddf0-\uddff]|\ud83c\uddf3\ud83c[\udde6\udde8\uddea-\uddec\uddee\uddf1\uddf4\uddf5\uddf7\uddfa\uddff]|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c[\udde6\uddea-\udded\uddf0-\uddf3\uddf7-\uddf9\uddfc\uddfe]|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c[\uddea\uddf4\uddf8\uddfa\uddfc]|\ud83c\uddf8\ud83c[\udde6-\uddea\uddec-\uddf4\uddf7-\uddf9\uddfb\uddfd-\uddff]|\ud83c\uddf9\ud83c[\udde6\udde8\udde9\uddeb-\udded\uddef-\uddf4\uddf7\uddf9\uddfb\uddfc\uddff]|\ud83c\uddfa\ud83c[\udde6\uddec\uddf2\uddf3\uddf8\uddfe\uddff]|\ud83c\uddfb\ud83c[\udde6\udde8\uddea\uddec\uddee\uddf3\uddfa]|\ud83c\uddfc\ud83c[\uddeb\uddf8]|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c[\uddea\uddf9]|\ud83c\uddff\ud83c[\udde6\uddf2\uddfc]|\ud83c[\udccf\udd8e\udd91-\udd9a\udde6-\uddff\ude01\ude32-\ude36\ude38-\ude3a\ude50\ude51\udf00-\udf20\udf2d-\udf35\udf37-\udf7c\udf7e-\udf84\udf86-\udf93\udfa0-\udfc1\udfc5\udfc6\udfc8\udfc9\udfcf-\udfd3\udfe0-\udff0\udff4\udff8-\udfff]|\ud83d[\udc00-\udc3e\udc40\udc44\udc45\udc51-\udc65\udc6a-\udc6d\udc6f\udc79-\udc7b\udc7d-\udc80\udc84\udc88-\udca9\udcab-\udcfc\udcff-\udd3d\udd4b-\udd4e\udd50-\udd67\udda4\uddfb-\ude44\ude48-\ude4a\ude80-\udea2\udea4-\udeb3\udeb7-\udebf\udec1-\udec5\uded0-\uded2\uded5\udeeb\udeec\udef4-\udefa\udfe0-\udfeb]|\ud83e[\udd0d\udd0e\udd10-\udd17\udd1d\udd20-\udd25\udd27-\udd2f\udd3a\udd3c\udd3f-\udd45\udd47-\udd71\udd73-\udd76\udd7a-\udda2\udda5-\uddaa\uddae-\uddb4\uddb7\uddba\uddbc-\uddca\uddd0\uddde-\uddff\ude70-\ude73\ude78-\ude7a\ude80-\ude82\ude90-\ude95]|[\u23e9-\u23ec\u23f0\u23f3\u267e\u26ce\u2705\u2728\u274c\u274e\u2753-\u2755\u2795-\u2797\u27b0\u27bf\ue50a])|\ufe0f/g;
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
            const panels = database.discord.collection<Discord.panel>("Panels");
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
                            .then(async channel => {
                                await (<TextChannel>channel).messages.fetch(res.value.message)
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
                            .then(async channel => {
                                await (<TextChannel>channel).messages.fetch(panel.message)
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