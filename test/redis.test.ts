// Dependencies
import { createClient, RedisClientType } from 'redis';
const redis: RedisClientType = createClient();
export default redis;

let redisClient: RedisClientType | null = null;

const getClient = () => {
	if (!redisClient) {
		redisClient = createClient();
	}
	return redisClient;
};

export { getClient };
