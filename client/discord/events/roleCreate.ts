import type { Event } from '../types';

const event: Event = {
    name: 'roleCreate',
    once: false,
    async execute(role, { client }) {
        if (role.managed) return;
        if (role.permissions.has('ADMINISTRATOR')) {
            const commands = await client.application.commands.fetch().then(commands => {
                const admin_commands = client.chatCommands.filter(command => command.isAdministrator);
                return commands.filter(command => admin_commands.has(command.name));
            });
            let permissions = await client.application.commands.permissions.fetch({ guild: role.guild });
            for (const [command_id, perms] of permissions) {
                if (perms.length === 10) continue;
                if (commands.has(command_id)) {
                    perms.push({
                        id: role.id,
                        type: "ROLE",
                        permission: true
                    });
                }
            }
            await client.application.commands.permissions.set({
                guild: role.guild,
                fullPermissions: permissions.map((_, command_id) => ({
                    id: command_id,
                    permissions: permissions.get(command_id)
                }))
            });
            if (role.guild.premiumTier !== "NONE") {
                const sticker_command = await role.guild.commands.fetch().then(commands => commands.find(command => command.name === "sticker"));
                if (sticker_command) await sticker_command.permissions.add({
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