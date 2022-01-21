import type { Event } from '../types';

const event: Event = {
    name: 'roleCreate',
    once: false,
    async execute(role, { client }) {
        if (role.managed) return;
        if (role.permissions.has('ADMINISTRATOR')) {
            const commands = await client.application.commands.fetch().then(commands => {
                const adminCommands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => adminCommands.has(command.name));
            });
            let permissions = await client.application.commands.permissions.fetch({ guild: role.guild });
            for (const [commandId, perms] of permissions) {
                if (perms.length === 10) continue;
                if (commands.has(commandId)) {
                    perms.push({
                        id: role.id,
                        type: "ROLE",
                        permission: true
                    });
                }
            }
            await client.application.commands.permissions.set({
                guild: role.guild,
                fullPermissions: permissions.map((_, commandId) => ({
                    id: commandId,
                    permissions: permissions.get(commandId)
                }))
            });
            if (role.guild.premiumTier !== "NONE") {
                const stickerCommand = await role.guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (stickerCommand) await stickerCommand.permissions.add({
                    permissions: [{
                        id: role.id,
                        type: "ROLE",
                        permission: true
                    }]
                });
            }
        }
    }
}
export = event;