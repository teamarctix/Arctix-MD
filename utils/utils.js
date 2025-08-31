// utils.js
module.exports = {
    /**
     * Reply to a message
     * @param {object} sock - WA socket
     * @param {object} m - Message object
     * @param {string|object} text - Reply text or message object
     * @param {object} options - Extra Baileys options
     */
    reply: async (sock, m, text, options = {}) => {
        const jid = m.key.remoteJid;
        const msg = typeof text === "string" ? { text } : text;
        return await sock.sendMessage(jid, msg, { quoted: m, ...options });
    }
};


