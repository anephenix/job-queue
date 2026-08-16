# Job Queue

[![npm version](https://badge.fury.io/js/%40anephenix%2Fjob-queue.svg)](https://badge.fury.io/js/%40anephenix%2Fjob-queue) [![Node.js CI](https://github.com/anephenix/job-queue/actions/workflows/node.js.yml/badge.svg)](https://github.com/anephenix/job-queue/actions/workflows/node.js.yml) [![Socket Badge](https://socket.dev/api/badge/npm/package/@anephenix/job-queue)](https://socket.dev/npm/package/@anephenix/job-queue)

A Node.js Job Queue library using Redis or Postgres.

### Features

-   Create job queues
-   Create workers to process jobs on those queues
-   Store the queues and jobs in Redis or Postgres for data persistence
-   Use hooks to trigger actions during the job lifecycle

### Dependencies

-   [Node.js](https://nodejs.org)
-   [Redis](https://redis.io) or [Postgres](https://www.postgresql.org)

### Install

```shell
npm i @anephenix/job-queue
```

### Usage

You will need a create a Redis client, and make it accessible to the queue files, perhaps in a redis.ts file:

```typescript
// Dependencies
import { createClient, type RedisClientType } from "redis";
import config from "./config.ts";

const redis: RedisClientType = createClient(config.redis);
await redis.connect();
export default redis;

```

Once you have that, you can create a queue like this:

```typescript
import redis from './redis.ts';
import type { RedisClientType } from 'redis';
import { Queue, type Hooks } from '@anephenix/job-queue';

type QueueOptions = { queueKey: string; redis: RedisClientType, hooks: Partial<Hooks> };
const queueOptions:QueueOptions = { queueKey: 'messages', redis, hooks: {} };
const messageQueue = new Queue(queueOptions);

export default messageQueue;
```

#### Adding jobs

Once you have the queue ready, you can add jobs like this:

```typescript
const job = {
	name: 'job-001',
	data: {
		from: 'bob@bob.com',
		to: 'sally@sally.com',
		subject: 'Have you got the document for ML results?',
		body: 'I want to check what the loss rate was. Thanks.',
	},
};

await messageQeueue.add({ name: 'message', data });
```

#### Setting up workers to process those jobs

Workers can be setup like this:

```typescript
import { type Job, Worker } from '@anephenix/job-queue';
import messageQueue from '../queues/messageQueue.ts';

type MessageJob = Job & {
	data: {
		id: string;
		to: string;
		from: string;
		content: string;
		created_at: string;
	}
};

class MessageWorker extends Worker {
	async processJob(job:Job): Promise<void> {
		this.status = 'processing';
		try {
            /* Do something with the job's data */
			const { id, from, to, content } = job.data;

            await this.completeJob(job);
		} catch (err) {
			console.error('Error processing job:', err);
			await this.failJob(job);
		}
		return;
	}
}

const messageWorker = new MessageWorker(messageQueue);

export default messageWorker;
```

Workers are the base class on which to create Workers tailored to processing
the job. In the example above, we have an EmailWorker whose processJob
function is customised to send an email via the 'sendEmail' function. The
worker is now setup to start processing jobs.

#### Starting the worker

```typescript
await emailWorker.start();
```

The worker will now poll the queue for available jobs. Once it has one, it
will take the job and process it.

#### Stopping the worker

```typescript
await emailWorker.stop();
```

### Advanced Features

#### Using hooks in the Queue

Hooks are a way to trigger functions before and after these actions are
called on the queue:

-   add
-   take
-   complete
-   fail

This gives you the ability to do things like collect data on how many jobs
are being added to a queue, how quickly they are being processed, and so on.

There are 2 types of hook, pre and post. A pre hook is called before the
action is triggered, and a post hook is called after.

The way to setup hooks to call can be demonstrated in the example below:

```typescript
const queueKey = 'email';
const queue = new Queue({
	queueKey,
	redis,
	hooks: {
		add: {
			pre: async (job) => {
				// Do something with the job before it is added
				return job;
			},
			post: async (job) => {
				// Do something with the job after it is added
				return job;
			},
		},
		take: {},
		complete: {},
		fail: {},
	},
});
```

#### Using Postgres instead of Redis

If you'd rather not run Redis, `PostgresQueue` provides the same API as
`Queue`, backed by a Postgres table instead. You will need a `pg` Pool,
made accessible to the queue files, perhaps in a postgres.ts file:

```typescript
// Dependencies
import { Pool } from "pg";
import config from "./config.ts";

const pool = new Pool(config.postgres);

export default pool;
```

Before using a queue for the first time, create its backing table by
calling the `migrate` static method once (e.g. as part of your app's
startup or a migration script). It is idempotent, so it's safe to call
on every boot:

```typescript
import { PostgresQueue } from "@anephenix/job-queue";
import pool from "./postgres.ts";

await PostgresQueue.migrate(pool);
```

Then create a queue the same way you would with Redis:

```typescript
import pool from "./postgres.ts";
import { PostgresQueue, type Hooks } from "@anephenix/job-queue";

type QueueOptions = { queueKey: string; pg: typeof pool; hooks: Partial<Hooks> };
const queueOptions: QueueOptions = { queueKey: "messages", pg: pool, hooks: {} };
const messageQueue = new PostgresQueue(queueOptions);

export default messageQueue;
```

`PostgresQueue` implements the same `add`, `take`, `complete`, `fail`,
`release`, `retry`, `inspect`, `count`, `counts`, `flushAll` and `disconnect`
methods as `Queue`, and hooks work identically. Because `Worker` only
depends on that shared interface, `Worker` instances work unchanged
with either `Queue` or `PostgresQueue`.

All queues share one `job_queue_jobs` table by default, distinguished
by `queueKey`, similarly to how Redis queues share one Redis instance
distinguished by key prefixes. Pass a `tableName` option to `PostgresQueue`
(and to `migrate`) if you'd like a queue to use its own table.

### License and Credits

&copy;2026 Anephenix Ltd. Job Queue is licensed under the MIT license.
