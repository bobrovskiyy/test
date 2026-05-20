import { statusBedrock } from "minecraft-server-util";

const HOST = "dragonland-b8nk.aternos.me";
const PORT = 19132;

let sent = 0;

async function spamPing() {
    sent++;

    const start = Date.now();

    try {
        const result = await statusBedrock(HOST, PORT, {
            timeout: 3000
        });

        console.warn(
            `[${sent}] ${result.roundTripLatency}ms | real ${Date.now() - start}ms`
        );
    } catch (e) {
        console.warn(`[${sent}] offline/error`);
    }

    setImmediate(spamPing);
}

spamPing();