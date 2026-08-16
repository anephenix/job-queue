import type { Hook, Hooks, Job } from "./types.ts";

abstract class BaseQueue {
	hooks: Hooks;

	constructor(hooks?: Partial<Hooks>) {
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
			hooks,
		);
	}

	protected async callHook(
		action: keyof Hooks,
		stage: keyof Hook,
		job?: Job | undefined,
	): Promise<void> {
		if (typeof this.hooks[action][stage] === "function") {
			return await this.hooks[action][stage]?.(job);
		}
	}
}

export { BaseQueue };
