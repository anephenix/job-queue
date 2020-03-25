# Job Queue

[![npm version](https://badge.fury.io/js/%40anephenix%2Fjob-queue.svg)](https://badge.fury.io/js/%40anephenix%2Fjob-queue) [![CircleCI](https://circleci.com/gh/anephenix/job-queue.svg?style=shield)](https://circleci.com/gh/anephenix/job-queue)
[![Coverage Status](https://coveralls.io/repos/github/anephenix/job-queue/badge.svg?branch=master)](https://coveralls.io/github/anephenix/job-queue?branch=master)  [![Maintainability](https://api.codeclimate.com/v1/badges/8549f1da9906b66d02ea/maintainability)](https://codeclimate.com/github/anephenix/job-queue/maintainability)

A Node.js Job Queue library using Redis.

### Features

-   Create job queues
-   Create workers to process jobs on those queues
-   Store the queues and jobs in Redis for data persistence
-   Use hooks to trigger actions during the job lifecycle

### Dependencies

-   [Node.js](https://nodejs.org)
-   [Redis](https://redis.io)

### Install

```shell
npm i @anephenix/job-queue
```

### Usage

You will need a create a Redis client that is promisified with bluebird.

```javascript
// Dependencies
const bluebird = require('bluebird');
const redisLib = require('redis');
bluebird.promisifyAll(redisLib.RedisClient.prototype);
bluebird.promisifyAll(redisLib.Multi.prototype);
const redisConfig = {};
const redis = redisLib.createClient(redisConfig);
```

Once you have that, you can create a queue like this:

```javascript
const { Queue } = require('@anephenix/job-queue');

const emailQueue = new Queue({ queueKey: 'email', redis });
```

#### Adding jobs

Once you have the queue ready, you can add jobs like this:

```javascript
const job = {
	name: 'job-001',
	data: {
		from: 'bob@bob.com',
		to: 'sally@sally.com',
		subject: 'Have you got the document for ML results?',
		body: 'I want to check what the loss rate was. Thanks.',
	},
};

emailQueue.add(job);
```

#### Setting up workers to process those jobs

Workers can be setup like this:

```javascript
const { Worker } = require('@anephenix/job-queue');
const sendEmail = require('./sendEmail');

class EmailWorker extends Worker {
	async processJob(job) {
		this.status = 'processing';
		try {
			await sendEmail(job);
			await this.completeJob(job);
		} catch (err) {
			await this.failJob(job);
		}
		return;
	}
}

const emailWorker = new EmailWorker(emailQueue);
```

Workers are the base class on which to create Workers tailored to processing
the job. In the example above, we have an EmailWorker whose processJob
function is customised to send an email via the 'sendEmail' function. The
worker is now setup to start processing jobs.

#### Starting the worker

```javascript
await emailWorker.start();
```

The worker will now poll the queue for available jobs. Once it has one, it
will take the job and process it.

#### Stopping the worker

```javascript
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

```javascript
const queueKey = 'email';
const queue = new Queue({
	queueKey,
	redis,
	hooks: {
		add: {
			pre: async job => {
				// Do something with the job before it is added
				return job;
			},
			post: async job => {
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

### License and Credits

&copy;2020 Anephenix OÜ. Job Queue is licensed under the MIT license.
