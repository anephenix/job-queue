class Queue {
	constructor({ queueKey, redis }) {
		this.redis = redis;
		this.subQueueKeys = {
			available: `${queueKey}-available`,
			processing: `${queueKey}-processing`,
			completed: `${queueKey}-completed`,
			failed: `${queueKey}-failed`
		};
	}

	async add(job) {
		const payload = JSON.stringify(job);
		return await this.redis.rpushAsync(this.subQueueKeys.available, payload);
	}

	async inspect() {
		const job = await this.redis.lindexAsync(this.subQueueKeys.available, -1);
		if (!job) return null;
		return JSON.parse(job);
	}

	async take() {
		const job = await this.redis.lpopAsync(this.subQueueKeys.available);
		if (!job) return null;
		await this.redis.rpushAsync(this.subQueueKeys.processing, job);
		return JSON.parse(job);
	}

	async complete(job) {
		const payload = JSON.stringify(job);
		await this.redis.lremAsync(this.subQueueKeys.processing, 1, payload);
		return await this.redis.rpushAsync(this.subQueueKeys.completed, payload);
	}

	async fail(job) {
		const payload = JSON.stringify(job);
		await this.redis.lremAsync(this.subQueueKeys.processing, 1, payload);
		return await this.redis.rpushAsync(this.subQueueKeys.failed, payload);
	}

	async flushAll() {
		for (const subQueueKey of Object.values(this.subQueueKeys)) {
			await this.redis.delAsync(subQueueKey);
		}
	}
}

module.exports = Queue;
