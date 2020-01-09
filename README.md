# Job Queue

[![npm version](https://badge.fury.io/js/%40anephenix%2Fjob-queue.svg)](https://badge.fury.io/js/%40anephenix%2Fjob-queue) [![CircleCI](https://circleci.com/gh/anephenix/job-queue.svg?style=shield)](https://circleci.com/gh/anephenix/job-queue)
[![Coverage Status](https://coveralls.io/repos/github/anephenix/job-queue/badge.svg?branch=master)](https://coveralls.io/github/anephenix/job-queue?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/anephenix/job-queue.svg)](https://greenkeeper.io/) [![Maintainability](https://api.codeclimate.com/v1/badges/8549f1da9906b66d02ea/maintainability)](https://codeclimate.com/github/anephenix/job-queue/maintainability)

A Node.js library for job queues, using Redis to store the queue data.

The Queue class manages working with Redis to move the job between these
lists, and provides a simple interface to working with job queues.

The Worker class provides a way to write programs that work with the queue to
fetch jobs, process them, and either mark them as completed or failed.

### Dependencies

- [Node.js](https://nodejs.org)
- [Redis](https://redis.io)

### Install

```shell
npm i @anephenix/job-queue
```

### Usage

You will need a create a Redis client that is promisified with bluebird.

```javascript
// Dependencies
const bluebird = require("bluebird");
const redisLib = require("redis");
bluebird.promisifyAll(redisLib.RedisClient.prototype);
bluebird.promisifyAll(redisLib.Multi.prototype);
const redisConfig = {};
const redis = redisLib.createClient(redisConfig);
```

Once you have that, you can create a queue like this:

```javascript
const { Queue } = require("@anephenix/job-queue");

const emailQueue = new Queue({ queueKey: "email", redis });
```

#### Adding jobs

Once you have the queue ready, you can add jobs like this:

```javascript
const job = {
  name: "job-001",
  data: {
    from: "bob@bob.com",
    to: "sally@sally.com",
    subject: "Have you got the document for ML results?",
    body: "I want to check what the loss rate was. Thanks."
  }
};

emailQueue.add(job);
```

#### Setting up workers to process those jobs

Workers can be setup like this:

```javascript
const { Worker } = require("@anephenix/job-queue");
const sendEmail = require("./sendEmail");

class EmailWorker extends Worker {
  async processJob(job) {
    this.status = "processing";
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

### License and Credits

&copy;2020. Anephenix OÜ. Job Queue is licensed under the MIT license.
