const crypto = require("crypto");

module.exports = async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(200).json({ error: "Only POST allowed" });
    }

    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        const { amount, description } = req.body || {};

        if (!terminalKey || !password) {
            return res.status(500).json({ error: "ENV not set" });
        }

        if (!amount) {
            return res.status(400).json({ error: "No amount" });
        }

        const orderId = `order_${Date.now()}`;

        const base = {
            Amount: String(amount),
            Description: description || "Оплата",
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto.createHash("sha256")
            .update(Object.keys(base).sort().map(k => base[k]).join(""))
            .digest("hex");

        const response = await fetch("https://securepay.tinkoff.ru/v2/Init", {
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

        const data = await response.json();

        return res.status(200).json({
            paymentUrl: data.PaymentURL || null
        });

    } catch (e) {
        return res.status(500).json({
            error: e.message
        });
    }
};
