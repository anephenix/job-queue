/*
    We use this as a check to ensure that the CommonJS build loads correctly.
*/

// Dependencies
const { Queue, Worker } = require("../dist/index.js");
const redisLib = require("redis");

// Configuration
const redisConfig = {};
const redis = redisLib.createClient(redisConfig);
const hooks = {};

try {
	const queue = new Queue({
		queueKey: "test-queue",
		redis,
		hooks,
	});

	(async () => {
		// Setup a Worker instance
		const worker = new Worker(queue);

		// If nothing breaks by now, then the CommonJS build is working correctly.
		console.log("CommonJS test passed successfully!");
		await worker.stop();
		process.exit(0);
	})();
} catch (error) {
	console.error("Error during CommonJS build check:", error);
	process.exit(1);
}
