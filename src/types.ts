import { RedisClientType } from 'redis';

export interface Job {
	name: string;
	[key: string]: any;
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
