const crypto = require("crypto");

module.exports = async (req, res) => {
    try {
        const terminalKey = process.env.TERMINAL_KEY;
        const password = process.env.TERMINAL_PASSWORD;

        if (!terminalKey || !password) {
            return res.status(500).send("Не настроены переменные окружения");
        }

        const amount = parseInt(req.query.amount, 10);
        const description = req.query.description || "Свободная оплата";
        // Важно: для чека нужен email или телефон клиента.
        // Передавайте его из Таплинка в query-параметрах (например, ?amount=1000&email=test@test.ru)
        const email = req.query.email || "customer@example.com";

        if (Number.isNaN(amount)) {
            return res.status(400).json({ error: "Некорректная сумма" });
        }

        if (amount < 1000) {
            return res.status(400).json({ error: "Минимум 10 рублей (1000 копеек)" });
        }

        const orderId = `order_${Date.now()}`;

        // 1. Токен подписывает ТОЛЬКО плоские параметры верхнего уровня.
        // Массив Receipt сюда НЕ добавляется.
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

        // 2. Формируем объект чека в соответствии с 54-ФЗ и требованиями Т-Банка
        const receipt = {
            Email: email, // Email покупателя, куда уйдет чек
            Taxation: "usn_income", // Ваша система налогообложения (например: osn, usn_income, usn_income_outcome, patent)
            Items: [
                {
                    Name: description, // Название товара/услуги в чеке
                    Price: amount,     // Цена за 1 шт. в копейках
                    Quantity: 1.00,     // Количество
                    Amount: amount,     // Общая стоимость позиции в копейках
                    PaymentMethod: "full_prepayment", // Способ расчета (полная предоплата)
                    PaymentObject: "service",         // Предмет расчета (услуга, или "commodity" - товар)
                    Tax: "none"         // Ставка НДС (none - без НДС, vat20 - 20%, vat10 - 10%)
                }
            ]
        };

        // 3. Отправляем запрос вместе с чеком
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
                Receipt: receipt // <-- Передаем кассовый чек
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
