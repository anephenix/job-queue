// Dependencies
import { createClient, RedisClientType } from 'redis';

const redis: RedisClientType = createClient();
export default redis;
