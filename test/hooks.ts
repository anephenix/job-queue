import { delayUntil } from './helpers/index.test';
import { getClient } from './redis.test';

async function beforeAll(this: Mocha.Context) {
	const redisClient = getClient();
	const redisIsReady = async () => redisClient.isOpen && redisClient.isReady;
	return await delayUntil(redisIsReady, 10);
}

// Global teardown logic here
async function afterAll(this: Mocha.Context) {
	const redis = getClient();
	await redis.quit();
}

export const mochaHooks = {
	beforeAll: beforeAll,
	afterAll: afterAll,
};
