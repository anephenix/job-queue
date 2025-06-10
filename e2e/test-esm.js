/*
    We use this as a check to ensure that the ESM build loads correctly.
*/

// Dependencies
import { Queue, Worker } from '../dist/index.js';
import { createClient } from 'redis';

// Configuration
const redisConfig = {};
const hooks = {};

try {
	// Setup a Redis client
	const redis = createClient(redisConfig);

	// Setup a Queue instance
	const queue = new Queue({
		queueKey: 'test-queue',
		redis,
		hooks,
	});

	(async () => {
		// Setup a Worker instance
		const worker = new Worker(queue);

		// If nothing breaks by now, then the ESM build is working correctly.
		console.log('ESM test passed successfully!');
		await worker.stop();
		process.exit(0);
	})();
} catch (error) {
	console.error('Error during ESM build check:', error);
	process.exit(1);
}
