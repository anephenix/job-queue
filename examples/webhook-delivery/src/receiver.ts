import { createServer } from "node:http";

// A stand-in for a real webhook endpoint. It fails the first FAIL_FIRST_N
// requests it receives (500), then succeeds for every request after
// that - so running the worker against it exercises the retry/backoff
// path before eventually completing the job.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const FAIL_FIRST_N = process.env.FAIL_FIRST_N
	? Number(process.env.FAIL_FIRST_N)
	: 2;

let requestCount = 0;

const server = createServer((req, res) => {
	if (req.method !== "POST") {
		res.writeHead(404);
		res.end();
		return;
	}

	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
	});
	req.on("end", () => {
		requestCount += 1;
		console.log(`Received webhook #${requestCount}: ${body}`);

		if (requestCount <= FAIL_FIRST_N) {
			console.log(`  -> simulating failure (${requestCount}/${FAIL_FIRST_N})`);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "simulated failure" }));
			return;
		}

		console.log("  -> accepted");
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
	});
});

server.listen(PORT, () => {
	console.log(`Webhook receiver listening on http://localhost:${PORT}`);
	console.log(`Will fail the first ${FAIL_FIRST_N} requests, then succeed.`);
});
