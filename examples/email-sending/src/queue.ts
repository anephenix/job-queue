import { type Hooks, Queue } from "@anephenix/job-queue";
import redis from "./redis.ts";

type QueueOptions = {
	queueKey: string;
	redis: typeof redis;
	hooks: Partial<Hooks>;
};
const queueOptions: QueueOptions = { queueKey: "email", redis, hooks: {} };
const emailQueue = new Queue(queueOptions);

export default emailQueue;
