module.exports = {
    menu: {
        cmd: "menu",
        desc: "Show all available commands 📜",
        ownerOnly: false, // Anyone can see the menu
        run: async (sock, m, args, context) => {
            const { reply, commands, prefix, isOwner } = context;

            if (!commands || Object.keys(commands).length === 0) {
                return await reply(sock, m, "⚠️ No commands loaded.");
            }

            const publicCommands = [];
            const ownerCommands = [];

            // Separate public and owner-only commands
            Object.keys(commands).forEach(cmd => {
                const command = commands[cmd];
                const desc = command.desc || "No description";

                if (command.ownerOnly) {
                    ownerCommands.push(`${cmd} — ${desc}`);
                } else {
                    publicCommands.push(`${cmd} — ${desc}`);
                }
            });

            // Build menu text
            let menuText = "📜 *Available Commands*\n\n";

            if (publicCommands.length) {
                menuText += "*Public Commands:*\n";
                menuText += publicCommands.map(c => `• ${prefix}${c}`).join("\n") + "\n\n";
            }

            if (ownerCommands.length) {
                menuText += "*Owner-only Commands:*\n";
                // Add "(Owner Only)" label only for non-owners
                menuText += ownerCommands
                    .map(c => `• ${prefix}${c}${isOwner ? "" : " (Owner Only)"}`)
                    .join("\n") + "\n\n";
            }

            // Send the menu
            await reply(sock, m, menuText.trim());
        }
    }
};
