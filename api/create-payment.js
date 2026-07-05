const crypto = require("crypto");
const axios = require("axios");

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

        const baseObj = {
            Amount: String(amount),
            Description: description || "Оплата",
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto.createHash("sha256")
            .update(
                Object.keys(baseObj)
                    .sort()
                    .map(k => baseObj[k])
                    .join("")
            )
            .digest("hex");

        const response = await axios.post(
            "https://securepay.tinkoff.ru/v2/Init",
            {
                TerminalKey: terminalKey,
                Amount: amount,
                OrderId: orderId,
                Description: description || "Оплата",
                Token: token
            },
            {
                headers: { "Content-Type": "application/json" }
            }
        );

        const data = response.data;

        if (!data.Success) {
            return res.status(400).json(data);
        }

        return res.status(200).json({
            paymentUrl: data.PaymentURL
        });

    } catch (e) {
        console.error("ERROR:", e?.response?.data || e.message);

        return res.status(500).json({
            error: e.message,
            details: e?.response?.data || null
        });
    }
};
