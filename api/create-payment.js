const crypto = require("crypto");

module.exports = async (req, res) => {
    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).send("Не настроены переменные окружения");
        }

        const amount = parseInt(req.query.amount, 10);
        
        // Считываем email и name (с поддержкой разных регистров)
        const email = req.query.email || req.query.Email || "";
        const name = req.query.name || req.query.Name || "";

        // Формируем детальное назначение платежа для Т-Бизнес:
        // Пример: "Юридические услуги (Плательщик: Иванов Иван Иванович)"
        let description = "Юридические услуги";
        if (name) {
            description += ` (Плательщик: ${name})`;
        } else if (email) {
            description += ` (клиент: ${email})`;
        }

        if (Number.isNaN(amount)) {
            return res.status(400).json({ error: "Некорректная сумма" });
        }

        if (amount < 1000) {
            return res.status(400).json({ error: "Минимум 10 рублей (1000 копеек)" });
        }

        const randomTail = Math.floor(1000 + Math.random() * 9000);
        const orderId = `order_${Date.now()}_${randomTail}`;

        // Расчет токена
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

        // Объект чека
        const receipt = {
            Email: email || "customer@example.com",
            Taxation: "usn_income",
            Items: [
                {
                    Name: "Юридические услуги", // В самом чеке кассы оставляем чистое название
                    Price: amount,                
                    Quantity: 1.00,            
                    Amount: amount,            
                    PaymentMethod: "prepayment",
                    PaymentObject: "service",    
                    Tax: "vat5"
                }
            ]
        };

        // Формируем итоговое тело запроса к Т-Банку
        const payload = {
            TerminalKey: terminalKey,
            Amount: amount,
            OrderId: orderId,
            Description: description,
            Token: token,
            Receipt: receipt
        };

        const response = await fetch("https://securepay.tinkoff.ru/v2/Init", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.Success) {
            console.error("Ошибка Т-Банка:", data);
            return res.status(500).send(data.Details || data.Message || "Ошибка Т-Банка");
        }

        return res.redirect(data.PaymentURL);

    } catch (e) {
        console.error(e);
        return res.status(500).send(e.message);
    }
};
