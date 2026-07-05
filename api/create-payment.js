const crypto = require("crypto");

module.exports = async (req, res) => {
    try {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            return res.status(200).end();
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).json({ error: "ENV not set" });
        }

        const { amount, description } = req.body || {};

        if (!amount) {
            return res.status(400).json({ error: "No amount" });
        }

        const orderId = `order_${Date.now()}`;

        const payloadForSign = {
            Amount: String(amount),
            Description: description || "Оплата",
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto.createHash("sha256")
            .update(
                Object.keys(payloadForSign)
                    .sort()
                    .map(k => payloadForSign[k])
                    .join("")
            )
            .digest("hex");

        let tbankResponse;
        let tbankData;

        try {
            tbankResponse = await fetch("https://securepay.tinkoff.ru/v2/Init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    TerminalKey: terminalKey,
                    Amount: amount,
                    OrderId: orderId,
                    Description: description || "Оплата",
                    Token: token
                })
            });

            const text = await tbankResponse.text();

            try {
                tbankData = JSON.parse(text);
            } catch (e) {
                return res.status(500).json({
                    error: "Bank returned invalid response",
                    raw: text
                });
            }

        } catch (e) {
            return res.status(500).json({
                error: "Request to bank failed",
                details: e.message
            });
        }

        if (!tbankData || !tbankData.Success) {
            return res.status(400).json({
                error: tbankData?.Message || "Bank error",
                raw: tbankData
            });
        }

        return res.status(200).json({
            paymentUrl: tbankData.PaymentURL
        });

    } catch (e) {
        return res.status(500).json({
            error: "Server crash",
            details: e.message
        });
    }
};
