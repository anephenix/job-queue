# Job Queue

A Node.js library for job queues, using Redis to store the queue data.

### Dependencies

- [Node.js](https://nodejs.org)
- [Redis](https://redis.io)

### Install

```shell
npm i @anephenix/job-queue
```

### Key concepts

Job queue consists of 2 elements, queues and workers:

- Queues, essentially categorised lists of jobs that need processing.
- Workers, programs that process jobs on the queue.

Redis is used to store the data for the queues. Each queue consists of 4
lists in Redis. For example, say you have a queue named "email", in Redis
there will be 4 lists for that queue:

- email-available
- email-processing
- email-completed
- email-failed

A job that is added to the email queue will first be inserted into the
"email-available" list.

When a worker takes the job, the job is moved from the "email-available" list
into the "email-processing" list.

If the job is completed, the job is moved from the "email-processing" list to
the "email-completed" list.

If the job is failed, the job is moved from the "email-processing" list to
the "email-failed" list.

The Queue class manages working with Redis to move the job between these
lists, and provides a simple interface to working with job queues.

The Worker class provides a way to write programs that work with the queue to
fetch jobs, process them, and either mark them as completed or failed.

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

```
emailWorker.start();
```
