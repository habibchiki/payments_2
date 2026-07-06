const crypto = require("crypto");

module.exports = async (req, res) => {
    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).send("Не настроены переменные окружения");
        }

        const amount = parseInt(req.query.amount, 10);
        const description = req.query.description || "Оплата";

        if (!amount || amount < 1000) {
            return res.status(400).send("Некорректная сумма");
        }

        const orderId = `order_${Date.now()}`;

        const tokenData = {
            Amount: String(amount),
            Description: description,
            OrderId: orderId,
            Password: password,
            TerminalKey: terminalKey
        };

        const token = crypto
            .createHash("sha256")
            .update(
                Object.keys(tokenData)
                    .sort()
                    .map(key => tokenData[key])
                    .join("")
            )
            .digest("hex");

        const response = await fetch("https://securepay.tinkoff.ru/v2/Init", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                TerminalKey: terminalKey,
                Amount: amount,
                OrderId: orderId,
                Description: description,
                Token: token
            })
        });

        const data = await response.json();

        if (!data.Success) {
            return res.status(500).send(data.Message || "Ошибка Т-Банка");
        }

        return res.redirect(data.PaymentURL);

    } catch (e) {
        console.error(e);
        return res.status(500).send(e.message);
    }
};
