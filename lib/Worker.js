class Worker {
	constructor(queue) {
		this.queue = queue;
		this.status = 'available';
	}

	async start() {
		return await this.getJob();
	}

	async stop() {
		this.status = 'stopped';
	}

	async getJob() {
		const self = this;
		if (this.status === 'available') {
			const job = await this.queue.take();
			if (job) {
				await self.processJob(job);
			} else {
				setTimeout(async () => {
					await self.getJob();
				}, 1000);
			}
		}
		return;
	}

	async processJob(job) {
		this.status = 'processing';
		try {
			await this.completeJob(job);
		} catch (err) {
			await this.failJob(job);
		}
		return;
	}

	async concludeJob(job, queueCommand) {
		await this.queue[queueCommand](job);
		this.status = 'available';
		await this.getJob();
		return;
	}

	async completeJob(job) {
		return await this.concludeJob(job, 'complete');
	}

	async failJob(job) {
		return await this.concludeJob(job, 'fail');
	}

	async releaseJob(job) {
		return await this.concludeJob(job, 'release');
	}
}

module.exports = Worker;
