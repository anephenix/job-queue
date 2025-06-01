import type { Job, Hook, Hooks, QueueOptions } from './types';
import type { RedisClientType } from 'redis';

class Queue {
	redis: RedisClientType;
	subQueueKeys: { [key: string]: string };
	hooks: Hooks;

	constructor({ queueKey, redis, hooks }: QueueOptions) {
		this.redis = redis;
		this.subQueueKeys = {
			available: `${queueKey}-available`,
			processing: `${queueKey}-processing`,
			completed: `${queueKey}-completed`,
			failed: `${queueKey}-failed`,
		};
		this.hooks = Object.assign(
			{
				add: { pre: null, post: null },
				take: { pre: null, post: null },
				complete: { pre: null, post: null },
				fail: { pre: null, post: null },
				release: { pre: null, post: null },
				retry: { pre: null, post: null },
				flushAll: { pre: null, post: null },
			},
			hooks
		);
		(async () => {
			this.connect();
		})();
	}

	private async connect(): Promise<void> {
		try {
			await this.redis.ping();
		} catch {
			await this.redis.connect();
		}
	}

	async disconnect(): Promise<string> {
		return await this.redis.quit();
	}

	private async callHook(
		action: keyof Hooks,
		stage: keyof Hook,
		job?: Job | undefined
	): Promise<void> {
		if (typeof this.hooks[action][stage] === 'function') {
			return await this.hooks[action][stage]?.(job);
		}
	}

	async add(job: Job): Promise<void> {
		await this.callHook('add', 'pre', job);
		const payload = JSON.stringify(job);
		await this.redis.rPush(this.subQueueKeys.available, payload);
		return await this.callHook('add', 'post', job);
	}

	async inspect(
		keyType: keyof Queue['subQueueKeys'] = 'available'
	): Promise<Job | null> {
		const job = await this.redis.lIndex(this.subQueueKeys[keyType], -1);
		if (!job) return null;
		return JSON.parse(job);
	}

	async count(keyType: keyof Queue['subQueueKeys']): Promise<number> {
		return await this.redis.lLen(this.subQueueKeys[keyType]);
	}

	async counts(): Promise<{ [key: string]: number }> {
		const [available, processing, failed, completed] = await Promise.all([
			this.count('available'),
			this.count('processing'),
			this.count('failed'),
			this.count('completed'),
		]);
		return {
			available,
			processing,
			failed,
			completed,
		};
	}

	async take(): Promise<Job | null> {
		await this.callHook('take', 'pre');
		const job = await this.redis.lPop(this.subQueueKeys.available);
		if (!job) {
			await this.callHook('take', 'post');
			return null;
		}
		await this.redis.rPush(this.subQueueKeys.processing, job);
		await this.callHook('take', 'post', JSON.parse(job));
		return JSON.parse(job);
	}

	private async conclude(
		job: Job,
		callHookAction: keyof Hooks,
		subQueueKey: keyof Queue['subQueueKeys'],
		fromSubQueueKey?: keyof Queue['subQueueKeys']
	): Promise<void> {
		await this.callHook(callHookAction, 'pre', job);
		const payload = JSON.stringify(job);
		await this.redis.lRem(
			this.subQueueKeys[fromSubQueueKey || 'processing'],
			1,
			payload
		);
		await this.redis.rPush(this.subQueueKeys[subQueueKey], payload);
		return await this.callHook(callHookAction, 'post', job);
	}

	async complete(job: Job): Promise<void> {
		return await this.conclude(job, 'complete', 'completed');
	}

	async fail(job: Job): Promise<void> {
		return await this.conclude(job, 'fail', 'failed');
	}

	async release(job: Job): Promise<void> {
		return await this.conclude(job, 'release', 'available');
	}

	async retry(job: Job): Promise<void> {
		return await this.conclude(job, 'retry', 'available', 'failed');
	}

	async flushAll(): Promise<void> {
		await this.callHook('flushAll', 'pre');
		for (const subQueueKey of Object.values(this.subQueueKeys)) {
			await this.redis.del(subQueueKey);
		}
		await this.callHook('flushAll', 'post');
	}
}

export { Queue };
