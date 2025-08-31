const express = require("express");
const qrcode = require("qrcode");
const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const path = require("path");



require("dotenv").config();


global.config = {
    botName: process.env.BOT_NAME,
    ownerName: process.env.OWNER_NAME,
    ownerNumbers: process.env.OWNER_NUMBERS.split(","),
    botNumber: process.env.BOT_NUMBER,
    prefix: process.env.PREFIX,
    version: process.env.VERSION,
    commands: {},
    HOT_RELOAD: process.env.HOT_RELOAD,
    connectionMethod: process.env.CONNECTION_METHOD,
    DEV_MODE: process.env.DEV_MODE,
    SESSION_DIR: process.env.SESSION_DIR
};

// Import handlers
const { commandHandler } = require("./handlers/commandHandler");
const { eventHandler } = require("./handlers/eventHandler");
const { errorHandler } = require("./handlers/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = "";
let pairingCodeData = "";
let sock;

// ===== Dev Mode: clean sessions folder =====
if (global.config.DEV_MODE) {
    const sessionsDir = path.join(__dirname, global.config.SESSION_DIR);
    if (fs.existsSync(sessionsDir)) {
        fs.rmSync(sessionsDir, { recursive: true, force: true });
        console.log("🧹 Dev Mode: Cleared sessions folder");
    }
}



// ===== Plugin Loader & Hot Reload =====
function loadPlugins() {
    const pluginsDir = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

    fs.readdirSync(pluginsDir).forEach((plugin) => {
        if (!plugin.endsWith(".js")) return;
        const fullPath = path.join(pluginsDir, plugin);
        delete require.cache[require.resolve(fullPath)];

        try {
            const pluginModule = require(fullPath);

            if (typeof pluginModule === "function") {
                pluginModule(sock, global.config);
                console.log(`📦 Function Plugin Loaded: ${plugin}`);
                console.log(global.config.commands);
            } else if (pluginModule.cmd && typeof pluginModule.run === "function") {
                global.config.commands[pluginModule.cmd] = pluginModule.run;
                console.log(`📦 Command Plugin Loaded: ${plugin} [${pluginModule.cmd}]`);
            } else if (typeof pluginModule === "object") {
                const cmds = Object.values(pluginModule).filter(
                    (p) => p.cmd && typeof p.run === "function"
                );
                cmds.forEach(p => {
                    global.config.commands[p.cmd] = {
                        run: p.run,
                        desc: p.desc || "No description",
                        ownerOnly: p.ownerOnly || false
                    };
                    console.log(`📦 Command Plugin Loaded: ${plugin} [${p.cmd}]`);
                });

            } else {
                console.log(`⚠️ Plugin ${plugin} is not valid.`);
            }
        } catch (e) {
            console.log(`❌ Error loading plugin ${plugin}:`, e.message);
        }
    });
}

function enableHotReload() {
    const pluginsDir = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginsDir)) return;

    fs.watch(pluginsDir, { recursive: true }, (event, filename) => {
        if (filename && filename.endsWith(".js")) {
            console.log(`[HOT_RELOAD] Change detected in ${filename}. Reloading plugins...`);
            loadPlugins();
        }
    });
}

// ===== Bot Starter =====
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(global.config.SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        browser: [global.config.botName, "Chrome", global.config.version],
        getMessage: async () => { }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && global.config.connectionMethod === "qr") {
            qrCodeData = qr;
            console.log("📲 New QR generated, scan from web!");
            console.log("Also You Can Scan From Terminal");
            console.log("\n📲 Scan this QR in WhatsApp:\n");
            console.log(await qrcode.toString(qr, { type: "terminal"}));


        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("❌ Disconnected:", reason);
            if (reason !== DisconnectReason.loggedOut) {
                console.log("♻️ Restarting bot...");
                startBot();
            } else {
                console.log("⚠️ Logged out. Delete session and re-scan QR or re-generate pair code.");
            }
        } else if (connection === "open") {
            console.log(`✅ ${global.config.botName} Connected Successfully!`);
            qrCodeData = "";
            pairingCodeData = "";

            // ===== Load plugins & enable hot reload =====
            loadPlugins();
            if (global.config.HOT_RELOAD === "1") {
                enableHotReload();
                console.log("♻️ Hot-reload enabled for plugins.");
            }
        }
    });

    sock.ev.on("messages.upsert", async (msg) => {
        try {
            await commandHandler(sock, msg, global.config);
        } catch (err) {
            errorHandler(err, msg);
        }
    });

    sock.ev.on("group-participants.update", async (event) => {
        try {
            await eventHandler(sock, event, global.config);
        } catch (err) {
            errorHandler(err, event);
        }
    });

    return sock;
}

// ===== Routes =====
app.get("/", async (req, res) => {
    global.config.connectionMethod = "qr";
    if (qrCodeData) {
        const qrImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>${global.config.botName} QR</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-gray-900 flex items-center justify-center h-screen text-white">
                <div class="text-center bg-gray-800 p-8 rounded-2xl shadow-lg">
                    <h2 class="text-2xl font-bold mb-4">📱 Scan This QR</h2>
                    <img src="${qrImage}" class="mx-auto border-4 border-green-500 rounded-xl"/>
                    <p class="mt-4 text-gray-400">Refresh page if expired</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>${global.config.botName} Connected</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-green-900 flex items-center justify-center h-screen text-white">
                <div class="text-center bg-green-800 p-8 rounded-2xl shadow-lg">
                    <h2 class="text-2xl font-bold">✅ ${global.config.botName} Already Connected!</h2>
                </div>
            </body>
            </html>
        `);
    }
});

app.get("/pair", async (req, res) => {
    global.config.connectionMethod = "pair";

    if (!pairingCodeData && sock) {
        try {
            pairingCodeData = await sock.requestPairingCode(global.config.botNumber);
            console.log(`🔗 Pairing Code for ${global.config.botNumber}: ${pairingCodeData}`);
        } catch (err) {
            console.error("❌ Error generating pairing code:", err.message);
        }
    }

    if (pairingCodeData) {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>${global.config.botName} Pair Code</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-gray-900 flex items-center justify-center h-screen text-white">
                <div class="text-center bg-gray-800 p-8 rounded-2xl shadow-lg">
                    <h2 class="text-2xl font-bold mb-4">🔗 Pairing Code for ${global.config.botNumber}</h2>
                    <pre class="bg-black text-green-400 p-4 rounded-lg text-lg">${pairingCodeData}</pre>
                    <p class="mt-4 text-gray-400">Enter this in your WhatsApp app to connect</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>${global.config.botName} Connected</title><script src="https://cdn.tailwindcss.com"></script></head>
            <body class="bg-green-900 flex items-center justify-center h-screen text-white">
                <div class="text-center bg-green-800 p-8 rounded-2xl shadow-lg">
                    <h2 class="text-2xl font-bold">✅ ${global.config.botName} Already Connected!</h2>
                </div>
            </body>
            </html>
        `);
    }
});

// ===== Start Bot & Server =====
startBot();
app.listen(PORT, () => {
    console.log(`🌍 Server running on http://localhost:${PORT}`);
    console.log(`➡️ Use / for QR or /pair for Pair Code`);
});
