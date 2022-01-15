import type { Event } from '../types';

const event: Event = {
    name: "guildUpdate",
    once: false,
    async execute(oldGuild, newGuild, { client }) {
        const hasStickers = newGuild.premiumTier !== "NONE";
        const hadStickers = oldGuild.premiumTier !== "NONE";
        if (!hadStickers && hasStickers) {
            const command = client.chatCommands.find(command => command.data.name === "sticker");
            await newGuild.commands.create(command.data);
        } else if (hadStickers && !hasStickers) {
            const commands = await newGuild.commands.fetch();
            const command = commands.find(command => command.name === "sticker");
            if (command) await command.delete();
        }
        if (oldGuild.ownerId !== newGuild.ownerId) {
            const commands = await newGuild.commands.fetch();
            let permissions = await newGuild.commands.permissions.fetch({});
            permissions.forEach((permissions, command_id) => {
                if (commands.has(command_id)) {
                    permissions = permissions.filter(permission => ![oldGuild.ownerId, newGuild.ownerId].includes(permission.id));
                    permissions.push({
                        id: newGuild.ownerId,
                        type: "USER",
                        permission: true
                    });
                }
            });
            await newGuild.commands.permissions.set({
                fullPermissions: permissions.map((_, command_id) => ({
                    id: command_id,
                    permissions: permissions.get(command_id)
                }))
            });
        }
    }
}

export = event;