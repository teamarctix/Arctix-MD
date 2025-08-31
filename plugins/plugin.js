const axios = require("axios");

module.exports = {
    plugin: {
        cmd: "plugin",
        desc: "Manage dynamic plugins ⚡ (add, remove, list, reload) (owner only)",
        ownerOnly: true,
        run: async (sock, m, args, context) => {
            const { reply, isOwner, commands } = context;

            if (!isOwner) return await reply(sock, m, "❌ You are not allowed to run this command.");
            if (!args.length) return await reply(sock, m, "⚠️ Usage: .plugin <add|remove|list|reload> [args]");

            const action = args[0].toLowerCase();
            const target = args[1];

            try {
                switch (action) {
                    case "add":
                        if (!target) return await reply(sock, m, "⚠️ Provide a raw URL to load.");
                        const response = await axios.get(target);
                        const code = response.data;
                        let pluginModule = eval(code);

                        if (!pluginModule || typeof pluginModule !== "object") {
                            return await reply(sock, m, "⚠️ Invalid plugin format.");
                        }

                        let loadedCommands = [];
                        Object.values(pluginModule).forEach(plugin => {
                            if (plugin.cmd && typeof plugin.run === "function") {
                                commands[plugin.cmd] = {
                                    run: plugin.run,
                                    desc: plugin.desc || "No description",
                                    ownerOnly: plugin.ownerOnly || false
                                };
                                loadedCommands.push(
                                    `• ${plugin.cmd} — ${plugin.desc || "No description"}${plugin.ownerOnly ? " (Owner Only)" : ""}`
                                );
                            }
                        });

                        await reply(sock, m, loadedCommands.length
                            ? `✅ Plugin added successfully from URL:\n${target}\n\nCommands added:\n${loadedCommands.join("\n")}`
                            : "⚠️ No valid commands found in the plugin."
                        );
                        break;

                    case "remove":
                        if (!target) return await reply(sock, m, "⚠️ Provide the command name to remove.");
                        if (!commands[target]) return await reply(sock, m, `⚠️ Command "${target}" is not loaded.`);
                        delete commands[target];
                        await reply(sock, m, `✅ Command "${target}" has been removed.`);
                        break;

                    case "list":
                        const dynamicCmds = Object.keys(commands)
                            .map(c => `• ${c} — ${commands[c].desc || "No description"}${commands[c].ownerOnly ? " (Owner Only)" : ""}`);
                        await reply(sock, m, dynamicCmds.length
                            ? `📜 Loaded Commands:\n${dynamicCmds.join("\n")}`
                            : "⚠️ No dynamic commands loaded."
                        );
                        break;

                    case "reload":
                        if (!target) return await reply(sock, m, "⚠️ Provide the command name or URL to reload.");

                        if (target.startsWith("http")) {
                            const res = await axios.get(target);
                            const codeReload = res.data;
                            let pluginModuleReload = eval(codeReload);
                            let reloaded = [];

                            Object.values(pluginModuleReload).forEach(plugin => {
                                if (plugin.cmd && typeof plugin.run === "function") {
                                    commands[plugin.cmd] = {
                                        run: plugin.run,
                                        desc: plugin.desc || "No description",
                                        ownerOnly: plugin.ownerOnly || false
                                    };
                                    reloaded.push(plugin.cmd);
                                }
                            });

                            await reply(sock, m, reloaded.length
                                ? `✅ Plugin reloaded from URL:\n${target}\nCommands: ${reloaded.join(", ")}`
                                : "⚠️ No commands reloaded from the URL."
                            );
                        } else {
                            if (!commands[target]) return await reply(sock, m, `⚠️ Command "${target}" not found.`);
                            const cmdData = commands[target];
                            delete commands[target];
                            commands[target] = cmdData;
                            await reply(sock, m, `✅ Command "${target}" has been reloaded.`);
                        }
                        break;

                    default:
                        await reply(sock, m, "⚠️ Unknown action. Use: add, remove, list, reload");
                        break;
                }
            } catch (err) {
                await reply(sock, m, `❌ Error: ${err.message}`);
            }
        }
    }
};
