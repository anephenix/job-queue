import emailQueue from "./queue.ts";

const [to, subject, ...rest] = process.argv.slice(2);
const text = rest.join(" ");

if (!to || !subject || !text) {
	console.error('Usage: npm run add-job -- <to> "<subject>" "<body text>"');
	process.exit(1);
}

await emailQueue.add({
	name: "send-email",
	data: { to, subject, text },
});

console.log(`Queued email to ${to}: ${subject}`);
await emailQueue.disconnect();
