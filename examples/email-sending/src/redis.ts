import { createClient, type RedisClientType } from "redis";

const redis: RedisClientType = createClient();
await redis.connect();

export default redis;
