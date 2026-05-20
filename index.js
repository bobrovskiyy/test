import TelegramBot from "node-telegram-bot-api";
import { statusBedrock } from "minecraft-server-util";

const TOKEN = "8837522982:AAE_c3GasGMqe-_neZy_OznvEwHtvx5_Uas"

const bot = new TelegramBot(TOKEN, {
    polling: true
});

const userStates = new Map();
const activePings = new Map();

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

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
            "Формат:\nIP:PORT КОЛ-ВО DELAY(ms) MULTIPING\n\nПример:\nplay.server.net:19132 100 1000 5\n\nГде:\n100 = количество\n1000 = задержка\n5 = сколько одновременно пингов\n\nЕсли количество не указать — бесконечно."
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
    let delay = 1000;
    let multiPing = 1;

    if (args[1]) {
        const parsed = Number(args[1]);

        if (!Number.isNaN(parsed) && parsed > 0) {
            count = parsed;
        }
    }

    if (args[2]) {
        const parsed = Number(args[2]);

        if (!Number.isNaN(parsed) && parsed >= 0) {
            delay = parsed;
        }
    }

    if (args[3]) {
        const parsed = Number(args[3]);

        if (!Number.isNaN(parsed) && parsed > 0) {
            multiPing = parsed;
        }
    }

    if (multiPing > 100) {
        multiPing = 100;
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
        `Старт проверки ${host}:${port}\n` +
        `Delay: ${delay}ms\n` +
        `MultiPing: ${multiPing}`
    );

    let success = 0;
    let failed = 0;
    let sent = 0;

    async function pingWorker(workerId) {
        while (!pingData.stopped) {
            if (sent >= count) {
                break;
            }

            sent++;

            const currentId = sent;

            const start = Date.now();

            try {
                const result = await statusBedrock(host, port, {
                    timeout: 3000
                });

                success++;

                console.warn(
                    `[W${workerId}] #${currentId} ` +
                    `PING ${result.roundTripLatency}ms | ` +
                    `REAL ${Date.now() - start}ms | ` +
                    `ONLINE ${result.playersOnline}/${result.playersMax}`
                );

                await bot.sendMessage(
                    chatId,
                    `[W${workerId}] #${currentId}\n` +
                    `Пинг: ${result.roundTripLatency}ms\n` +
                    `Real: ${Date.now() - start}ms\n` +
                    `Онлайн: ${result.playersOnline}/${result.playersMax}`
                );
            } catch (e) {
                failed++;

                console.warn(
                    `[W${workerId}] #${currentId} ERROR`
                );

                await bot.sendMessage(
                    chatId,
                    `[W${workerId}] #${currentId}\nОшибка/оффлайн`
                );
            }

            if (delay > 0) {
                await sleep(delay);
            }
        }
    }

    const workers = [];

    for (let i = 1; i <= multiPing; i++) {
        workers.push(pingWorker(i));
    }

    await Promise.all(workers);

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