// commandHandler.js
const { reply } = require("../utils/utils");
const { errorHandler } = require("./errorHandler");

// Utility: extract text/command from any message type
function getText(m) {
    try {
        if (!m.message) return "";

        const type = Object.keys(m.message)[0];
        return (
            (type === "conversation" && m.message.conversation) ||
            (type === "extendedTextMessage" && m.message.extendedTextMessage?.text) ||
            (type === "imageMessage" && m.message.imageMessage?.caption) ||
            (type === "videoMessage" && m.message.videoMessage?.caption) ||
            (type === "documentMessage" && m.message.documentMessage?.caption) ||
            (type === "buttonsResponseMessage" && m.message.buttonsResponseMessage?.selectedButtonId) ||
            (type === "listResponseMessage" && m.message.listResponseMessage?.singleSelectReply?.selectedRowId) ||
            ""
        );
    } catch {
        return "";
    }
}

module.exports.commandHandler = async (sock, msg, config) => {
    try {
        const m = msg.messages[0];
        if (!m?.message) return;

        const from = m.key.remoteJid;
        const sender = m.key.participant || m.key.remoteJid; // works for groups & privates
        const senderId = sender.split("@")[0];
        const isGroup = from.endsWith("@g.us");
        const isChannel = from.endsWith("@newsletter");

        const text = getText(m);
        if (!text || !text.startsWith(config.prefix)) return;

        const args = text.trim().split(/ +/).slice(1);
        const cmd = text.slice(config.prefix.length).trim().split(/ +/)[0].toLowerCase();

        // commandObj might be either a function (old loader) or an object { run, desc, ownerOnly }
        const rawCmd = config.commands?.[cmd];

        // normalize to an object form
        let commandObj;
        if (typeof rawCmd === "function") {
            commandObj = { run: rawCmd, desc: rawCmd.desc || "No description", ownerOnly: rawCmd.ownerOnly || false };
        } else {
            commandObj = rawCmd; // could be undefined if not found
        }

        if (commandObj && typeof commandObj.run === "function") {
            // 🔑 Owner check
            const isOwner = config.ownerNumbers.includes(senderId) || senderId === config.botNumber;

            // Restrict owner-only commands
            if (commandObj.ownerOnly && !isOwner) {
                await reply(sock, m, "❌ This command is restricted to bot owners.");
                return;
            }

            // Build plugin context: include commands & prefix for plugins like .menu
            const pluginContext = {
                ...config,               // keep config top-level (prefix, ownerNumbers, etc.)
                isGroup,
                isChannel,
                isOwner,
                reply,
                commands: config.commands, // expose commands map
                prefix: config.prefix     // expose prefix explicitly
            };

            await commandObj.run(sock, m, args, pluginContext);

            console.log(
                `⚡ Command executed: ${cmd} | From: ${isGroup ? "Group" : isChannel ? "Channel" : "Private"} | By: ${senderId}`
            );
        } else {
            if (!isChannel) {
                console.log(`❌ Unknown command: ${cmd} | From: ${senderId}`);
                await reply(sock, m, `❌ Unknown command: ${cmd}`);
            }
        }
    } catch (err) {
        console.error("❌ Command Handler Error:", err);

        // Notify all owners automatically
        if (config.ownerNumbers?.length > 0 && sock) {
            for (const ownerId of config.ownerNumbers) {
                try {
                    const ownerJid = ownerId + "@s.whatsapp.net";
                    await sock.sendMessage(ownerJid, {
                        text: `⚠️ Error in command handler:\n${err.stack || err.message || err}`,
                    });
                } catch (e) {
                    console.error("⚠️ Error notifying owner:", e);
                }
            }
        }

        // Call errorHandler for consistency
        errorHandler(err, msg, sock);
    }
};
