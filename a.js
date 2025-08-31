module.exports = {
    image: {
        cmd: "image",
        desc: "Fetch images from Google Images 🌄 (default 1)",
        ownerOnly: false,
        run: async (sock, m, args, context) => {
            const { reply } = context;
            const gis = require('g-i-s');

            if (!args.length) {
                return reply(sock, m, "⚠️ Please provide a search term.");
            }

            // Check if last argument is a number (number of images)
            let numImages = 1; // default
            if (!isNaN(args[args.length - 1])) {
                numImages = Math.min(Math.max(parseInt(args.pop()), 1), 10); // 1-10 limit
            }

            const query = args.join(" ");

            gis(query, async (err, results) => {
                if (err) return reply(sock, m, "❌ Error fetching images: " + err.message);
                if (!results || results.length === 0) return reply(sock, m, "❌ No images found.");

                const images = results.slice(0, numImages);

                for (const img of images) {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { image: { url: img.url }, caption: "Here’s your image 📷" },
                        { quoted: m }
                    );
                }
            });
        }
    }
};
