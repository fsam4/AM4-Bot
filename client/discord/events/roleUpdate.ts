import type { Event } from '../types';

const event: Event = {
    name: 'roleUpdate',
    once: false,
    async execute(oldRole, newRole, { client }) {
        if (newRole.managed) return;
        const removed_permissions = newRole.permissions.missing(oldRole.permissions);
        const added_permissions = oldRole.permissions.missing(newRole.permissions);
        const guild = newRole.guild;
        if (added_permissions.includes('ADMINISTRATOR')) {          
            const commands = await client.application.commands.fetch().then(commands => {
                const admin_commands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => admin_commands.has(command.name));
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
                const sticker_command = await guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (sticker_command) await sticker_command.permissions.add({
                    permissions: [{
                        id: newRole.id,
                        type: "ROLE",
                        permission: true
                    }]
                });
            }
        } else if (removed_permissions.includes('ADMINISTRATOR')) {
            const commands = await client.application.commands.fetch().then(commands => {
                const admin_commands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => admin_commands.has(command.name));
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
                const sticker_command = await guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (sticker_command) await sticker_command.permissions.remove({ roles: newRole });
            }
        }
    }
}

export = event;