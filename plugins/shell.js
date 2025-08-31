const { exec } = require("child_process");

module.exports = {
    shell: {
        cmd: "shell",
        desc: "Execute shell commands 💻 (owner only)",
        ownerOnly: true, // explicitly mark owner-only
        run: async (sock, m, args, context) => {
            const { reply, isOwner } = context;

            if (!isOwner) {
                return await reply(sock, m, "❌ You are not allowed to run this command.");
            }

            const command = args.join(" ");
            if (!command) {
                return await reply(sock, m, "⚠️ Please provide a shell command to execute.");
            }

            try {
                exec(command, { timeout: 10000 }, async (error, stdout, stderr) => {
                    let output = stdout || stderr || error?.message || "No output";

                    // truncate output to 4000 chars for WhatsApp limits
                    if (output.length > 4000) {
                        output = output.slice(0, 4000) + "\n... (truncated)";
                    }

                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `📤 Output:\n\`\`\`\n${output}\n\`\`\`` },
                        { quoted: m }
                    );
                });
            } catch (err) {
                await reply(sock, m, `❌ Error: ${err.message}`);
            }
        }
    }
};
