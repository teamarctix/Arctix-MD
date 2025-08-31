module.exports = {
    eval: {
        cmd: "eval",
        desc: "Evaluate simple JavaScript code ⚡ (owner only)",
        ownerOnly: true, // enforced by commandHandler
        run: async (sock, m, args, context) => {
            const { reply, isOwner, commands } = context;

            if (!isOwner) {
                return await reply(sock, m, "❌ You are not allowed to run this command.");
            }

            if (!args.length) {
                return await reply(sock, m, "⚠️ Please provide JavaScript code to evaluate.");
            }

            try {
                // Join arguments and clean formatting
                let code = args.join(" ").replace(/\\`/g, "`").replace(/^```|```$/g, "");

                // Evaluate the code
                let result = await eval(code);

                // Convert non-string results to readable format
                if (typeof result !== "string") {
                    result = require("util").inspect(result, { depth: 2 });
                }

                await reply(sock, m, `✅ Result:\n${result}`);
            } catch (err) {
                await reply(sock, m, `❌ Error: ${err.message}`);
            }
        }
    }
};
