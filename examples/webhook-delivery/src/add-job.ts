import crypto from "node:crypto";
import webhookQueue from "./queue.ts";

const [url, payloadArg] = process.argv.slice(2);

if (!url || !payloadArg) {
	console.error("Usage: npm run add-job -- <url> '<json-payload>'");
	process.exit(1);
}

let payload: unknown;
try {
	payload = JSON.parse(payloadArg);
} catch {
	console.error("Payload must be valid JSON.");
	process.exit(1);
}

const id = crypto.randomUUID();

await webhookQueue.add({
	name: "webhook-delivery",
	data: { id, url, payload },
});

console.log(`Queued webhook ${id} -> ${url}`);
await webhookQueue.disconnect();
