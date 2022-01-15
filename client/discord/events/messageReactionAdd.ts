import type { Discord } from '@typings/database';
import type { Event } from '../types';

const event: Event = {
    name: "messageReactionAdd",
    once: false,
    async execute(reaction, user, { database }) {
        if (user.bot) return;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (reaction.message.channel.type === "DM") return;
        const panels = database.discord.collection<Discord.panel>("Panels");
        const panel = await panels.findOne({ 
            type: "message",
            message: reaction.message.id,
            channel: reaction.message.channelId,
            server: reaction.message.guildId
        });
        if (panel) {
            if (!panel.reactions.some(({ emoji }) => emoji.name === reaction.emoji.name || emoji.id === reaction.emoji.id)) return;
            const { role } = panel.reactions.find(({ emoji }) => emoji.name === reaction.emoji.name || emoji.id === reaction.emoji.id);
            await reaction.message.guild.members.fetch(user.id)
            .then(async member => {
                const reason = `Obtained via reaction role by ${reaction.message.author.username}#${reaction.message.author.discriminator}`;
                await member.roles.add(role, reason).catch(err => void err);
            })
            .catch(console.error)
        }
    }
};

export = event;