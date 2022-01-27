import type { Event } from '@discord/types';

const event: Event = {
    name: 'roleUpdate',
    once: false,
    async execute(oldRole, newRole, { client }) {
        if (newRole.managed) return;
        const removedPermissions = newRole.permissions.missing(oldRole.permissions);
        const addedPermissions = oldRole.permissions.missing(newRole.permissions);
        const guild = newRole.guild;
        if (addedPermissions.includes('ADMINISTRATOR')) {          
            const commands = await client.application.commands.fetch().then(commands => {
                const adminCommands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => adminCommands.has(command.name));
            });
            let permissions = await client.application.commands.permissions.fetch({ guild });
            for (const [commandId, perms] of permissions) {
                if (perms.length === 10) continue;
                if (commands.has(commandId)) {
                    perms.push({
                        id: newRole.id,
                        type: "ROLE",
                        permission: true
                    });
                }
            }
            await guild.commands.permissions.set({
                fullPermissions: permissions.map((_, commandId) => ({
                    id: commandId,
                    permissions: permissions.get(commandId)
                }))
            });
            if (guild.premiumTier !== "NONE") {
                const stickerCommand = await guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (stickerCommand) await stickerCommand.permissions.add({
                    permissions: [{
                        id: newRole.id,
                        type: "ROLE",
                        permission: true
                    }]
                });
            }
        } else if (removedPermissions.includes('ADMINISTRATOR')) {
            const commands = await client.application.commands.fetch().then(commands => {
                const adminCommands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => adminCommands.has(command.name));
            });
            let permissions = await client.application.commands.permissions.fetch({ guild });
            for (let [commandId, perms] of permissions) {
                if (commands.has(commandId)) {
                    const newPermissions = perms.filter(permission => permission.id !== newRole.id);
                    perms = newPermissions;
                }
            }
            await guild.commands.permissions.set({
                fullPermissions: permissions.map((_, commandId) => ({
                    id: commandId,
                    permissions: permissions.get(commandId)
                }))
            });
            if (guild.premiumTier !== "NONE") {
                const stickerCommand = await guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (stickerCommand) await stickerCommand.permissions.remove({ roles: newRole });
            }
        }
    }
}

export = event;