// eventHandler.js
module.exports.eventHandler = async (sock, event, config) => {
    try {
        // Skip newsletters (no participant events there)
        if (event.id.endsWith("@newsletter")) return;

        const metadata = await sock.groupMetadata(event.id);
        const participants = event.participants;

        for (let user of participants) {
            if (event.action === "add") {
                await sock.sendMessage(event.id, {
                    text: `👋 Welcome @${user.split("@")[0]} to *${metadata.subject}*`,
                    mentions: [user]
                });
            } else if (event.action === "remove") {
                await sock.sendMessage(event.id, {
                    text: `😢 Goodbye @${user.split("@")[0]} from *${metadata.subject}*`,
                    mentions: [user]
                });
            }
        }
    } catch (err) {
        console.error("❌ Event Handler Error:", err);
    }
};
