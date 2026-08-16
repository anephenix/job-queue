import type { Pool } from "pg";
import type { RedisClientType } from "redis";

export interface Job {
	name: string;
	[key: string]: unknown;
}

export interface Hook {
	pre?: ((job?: Job | undefined) => Promise<void> | void) | undefined;
	post?: ((job?: Job | undefined) => Promise<void> | void) | undefined;
}

export interface Hooks {
	add: Hook;
	take: Hook;
	complete: Hook;
	fail: Hook;
	release: Hook;
	retry: Hook;
	flushAll: Hook;
}

export interface QueueOptions {
	queueKey: string;
	redis: RedisClientType;
	hooks?: Partial<Hooks>;
}

export interface PostgresQueueOptions {
	queueKey: string;
	pg: Pool;
	hooks?: Partial<Hooks>;
	tableName?: string;
}

export type SubQueueKey = "available" | "processing" | "completed" | "failed";

export interface JobQueue {
	hooks: Hooks;
	add(job: Job): Promise<void>;
	inspect(keyType?: SubQueueKey): Promise<Job | null>;
	count(keyType: SubQueueKey): Promise<number>;
	counts(): Promise<{ [key: string]: number }>;
	take(): Promise<Job | null>;
	complete(job: Job): Promise<void>;
	fail(job: Job): Promise<void>;
	release(job: Job): Promise<void>;
	retry(job: Job): Promise<void>;
	flushAll(): Promise<void>;
	disconnect(): Promise<unknown>;
}
