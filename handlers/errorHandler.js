module.exports.errorHandler = async (err, context, sock) => {
    console.error("🔥 Error Caught:", err);

    try {
        if (global.config?.ownerNumbers?.length > 0 && sock) {
            const ownerJid = global.config.ownerNumbers[0] + "@s.whatsapp.net";
            if (context?.key?.remoteJid) {
                await sock.sendMessage(ownerJid, {
                    text: `⚠️ Error:\n${err.stack || err.message || err}`
                });
            }
        }
    } catch (e) {
        console.error("⚠️ Error while reporting:", e);
    }
};
