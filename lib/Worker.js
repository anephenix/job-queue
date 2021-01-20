class Worker {
	constructor(queue) {
		this.queue = queue;
		this.status = 'available';
		this.pollTimeout = 1000;
	}

	async start() {
		return await this.getJob();
	}

	async stop() {
		this.status = 'stopped';
		if (this.currentJob) {
			const skipSettingStatus = true;
			await this.releaseJob(this.currentJob, skipSettingStatus);
		}
	}

	async getJob() {
		const self = this;
		if (this.status === 'available') {
			const job = await this.queue.take();
			if (job) {
				self.currentJob = job;
				await self.processJob(job);
			} else {
				setTimeout(async () => {
					await self.getJob();
				}, this.pollTimeout);
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

	async concludeJob(job, queueCommand, skipSettingStatus) {
		this.currentJob = null;
		await this.queue[queueCommand](job);
		if (!skipSettingStatus) this.status = 'available';
		await this.getJob();
		return;
	}

	async completeJob(job, skipSettingStatus) {
		return await this.concludeJob(job, 'complete', skipSettingStatus);
	}

	async failJob(job, skipSettingStatus) {
		return await this.concludeJob(job, 'fail', skipSettingStatus);
	}

	async releaseJob(job, skipSettingStatus) {
		return await this.concludeJob(job, 'release', skipSettingStatus);
	}
}

module.exports = Worker;
