import TelegramBot from "node-telegram-bot-api";
import { statusBedrock } from "minecraft-server-util";

const TOKEN = "8837522982:AAE_c3GasGMqe-_neZy_OznvEwHtvx5_Uas";

const bot = new TelegramBot(TOKEN, {
    polling: true
});

const userStates = new Map();
const activePings = new Map();

function mainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Старт пинг",
                        callback_data: "start_ping"
                    }
                ],
                [
                    {
                        text: "Стоп",
                        callback_data: "stop_ping"
                    }
                ]
            ]
        }
    };
}

bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(
        msg.chat.id,
        "Выбери действие",
        mainMenu()
    );
});

bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === "start_ping") {
        userStates.set(chatId, {
            step: "host"
        });

        await bot.sendMessage(
            chatId,
            "Отправь IP:PORT и количество проверок\n\nПример:\nplay.server.net:19132 20\n\nЕсли количество не указать — будет бесконечно."
        );
    }

    if (query.data === "stop_ping") {
        const pingData = activePings.get(chatId);

        if (!pingData) {
            await bot.sendMessage(chatId, "Активных проверок нет.");
            return;
        }

        pingData.stopped = true;
        activePings.delete(chatId);

        await bot.sendMessage(chatId, "Все проверки остановлены.");
    }

    await bot.answerCallbackQuery(query.id);
});

bot.on("message", async (msg) => {
    if (!msg.text) {
        return;
    }

    const chatId = msg.chat.id;

    const state = userStates.get(chatId);

    if (!state || state.step !== "host") {
        return;
    }

    userStates.delete(chatId);

    const args = msg.text.trim().split(" ");

    const address = args[0];

    if (!address.includes(":")) {
        await bot.sendMessage(chatId, "Нужно указать IP:PORT");
        return;
    }

    const [host, portRaw] = address.split(":");

    const port = Number(portRaw);

    if (!host || Number.isNaN(port)) {
        await bot.sendMessage(chatId, "Неверный IP или PORT");
        return;
    }

    let count = Infinity;

    if (args[1]) {
        const parsed = Number(args[1]);

        if (!Number.isNaN(parsed) && parsed > 0) {
            count = parsed;
        }
    }

    if (activePings.has(chatId)) {
        await bot.sendMessage(chatId, "У тебя уже есть активная проверка.");
        return;
    }

    const pingData = {
        stopped: false
    };

    activePings.set(chatId, pingData);

    await bot.sendMessage(
        chatId,
        `Старт проверки ${host}:${port}`
    );

    let success = 0;
    let failed = 0;
    let sent = 0;

    while (!pingData.stopped) {
        if (sent >= count) {
            break;
        }

        sent++;

        const start = Date.now();

        try {
            const result = await statusBedrock(host, port, {
                timeout: 3000
            });

            success++;

            await bot.sendMessage(
                chatId,
                `#${sent}\n` +
                `Пинг: ${result.roundTripLatency}ms\n` +
                `Real: ${Date.now() - start}ms\n` +
                `Онлайн: ${result.playersOnline}/${result.playersMax}`
            );
        } catch (e) {
            failed++;

            await bot.sendMessage(
                chatId,
                `#${sent}\nОшибка/оффлайн`
            );
        }

        // безопасная задержка
        await new Promise(r => setTimeout(r, 1000));
    }

    activePings.delete(chatId);

    await bot.sendMessage(
        chatId,
        `Проверка завершена\n\n` +
        `Успешно: ${success}\n` +
        `Ошибок: ${failed}`,
        mainMenu()
    );
});

console.warn("Telegram bot started");
