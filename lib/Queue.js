class Queue {
	constructor({ queueKey, redis, hooks }) {
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
	}

	async callHook(action, stage, job) {
		if (typeof this.hooks[action][stage] === 'function') {
			return await this.hooks[action][stage](job);
		} else {
			return;
		}
	}

	async add(job) {
		await this.callHook('add', 'pre', job);
		const payload = JSON.stringify(job);
		await this.redis.rpushAsync(this.subQueueKeys.available, payload);
		return await this.callHook('add', 'post', job);
	}

	async inspect(keyType = 'available') {
		const job = await this.redis.lindexAsync(
			this.subQueueKeys[keyType],
			-1
		);
		if (!job) return null;
		return JSON.parse(job);
	}

	async take() {
		await this.callHook('take', 'pre');
		const job = await this.redis.lpopAsync(this.subQueueKeys.available);
		if (!job) {
			await this.callHook('take', 'post');
			return null;
		}
		await this.redis.rpushAsync(this.subQueueKeys.processing, job);
		await this.callHook('take', 'post', JSON.parse(job));
		return JSON.parse(job);
	}

	async conclude(job, callHookAction, subQueueKey, fromSubQueueKey) {
		await this.callHook(callHookAction, 'pre', job);
		const payload = JSON.stringify(job);
		await this.redis.lremAsync(
			this.subQueueKeys[fromSubQueueKey || 'processing'],
			1,
			payload
		);
		await this.redis.rpushAsync(this.subQueueKeys[subQueueKey], payload);
		return await this.callHook(callHookAction, 'post', job);
	}

	async complete(job) {
		return await this.conclude(job, 'complete', 'completed');
	}

	async fail(job) {
		return await this.conclude(job, 'fail', 'failed');
	}

	async release(job) {
		return await this.conclude(job, 'release', 'available');
	}

	async retry(job) {
		return await this.conclude(job, 'retry', 'available', 'failed');
	}

	async flushAll() {
		await this.callHook('flushAll', 'pre');
		for (const subQueueKey of Object.values(this.subQueueKeys)) {
			await this.redis.delAsync(subQueueKey);
		}
		await this.callHook('flushAll', 'post');
	}
}

module.exports = Queue;
