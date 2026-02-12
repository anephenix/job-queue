// Dependencies
import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

const getClient = () => {
	if (!redisClient) {
		redisClient = createClient();
	}
	return redisClient;
};

export { getClient };
