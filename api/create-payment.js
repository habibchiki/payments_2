const crypto = require("crypto");

module.exports = async (req, res) => {
    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).send("Не настроены переменные окружения");
        }

        const amount = parseInt(req.query.amount, 10);
        
        // Исправление 1: Vercel/Node переводят параметры в нижний регистр,
        // поэтому проверяем и req.query.email, и req.query.Email
        const email = req.query.email || req.query.Email || "customer@example.com";

        const description = "Юридические услуги";

        if (Number.isNaN(amount)) {
            return res.status(400).json({ error: "Некорректная сумма" });
        }

        if (amount < 1000) {
            return res.status(400).json({ error: "Минимум 10 рублей (1000 копеек)" });
        }

        const randomTail = Math.floor(1000 + Math.random() * 9000); //Генерирует 4 случайные цифры
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

        const receipt = {
            Email: email,
            Taxation: "usn_income",
            Items: [
                {
                    Name: description,         
                    Price: amount,                
                    Quantity: 1.00,            
                    Amount: amount,            
                    PaymentMethod: "prepayment", 
                    PaymentObject: "service",    
                    Tax: "vat5"                 
                }
            ]
        };

        // Отправляем запрос вместе с чеком
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
                Token: token,
                Receipt: receipt
            })
        });

        const data = await response.json();

        if (!data.Success) {
            console.error("Ошибка Т-Банка:", data);
            return res.status(500).send(data.Details || data.Message || "Ошибка Т-Банка");
        }

        console.log("Успешный ответ:", data);

        return res.redirect(data.PaymentURL);

    } catch (e) {
        console.error(e);
        return res.status(500).send(e.message);
    }
};
