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

	async completeJob(job) {
		await this.queue.complete(job);
		this.status = 'available';
		await this.getJob();
		return;
	}

	async failJob(job) {
		await this.queue.fail(job);
		this.status = 'available';
		await this.getJob();
		return;
	}
}

module.exports = Worker;
