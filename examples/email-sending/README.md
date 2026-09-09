# Example: Background email sending

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to send email in the background rather than as part of a request/response
cycle — the classic job queue use case. It uses the Redis-backed `Queue`
and [nodemailer](https://nodemailer.com/).

Emails are sent through an [Ethereal](https://ethereal.email) test
account, created automatically the first time the worker runs, so you can
try this out without any real SMTP credentials. Nothing lands in a real
inbox — instead, the worker logs a preview URL for each email it sends,
which you can open in a browser to see it.

### How it works

-   `src/redis.ts` creates and connects a Redis client.
-   `src/queue.ts` creates a `Queue` called `email`, backed by Redis.
-   `src/mailer.ts` lazily creates a nodemailer transporter using a fresh
    Ethereal test account.
-   `src/worker.ts` defines a `Worker` subclass that sends each queued
    job as an email.
-   `src/add-job.ts` is a small CLI script that queues an email.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

### Prerequisites

-   Node.js
-   Redis running locally on the default port (6379), e.g.:

    ```shell
    docker run -p 6379:6379 redis
    ```

-   An internet connection (needed to create the Ethereal test account
    and send through `smtp.ethereal.email`)

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Queue an email:

    ```shell
    npm run add-job -- someone@example.com "Hello" "This is a test email sent via a job queue."
    ```

2.  In another terminal, start the worker to process queued jobs:

    ```shell
    npm run worker
    ```

The worker will pick up the job, send it via Ethereal, and print a
preview URL, e.g. `Preview URL: https://ethereal.email/message/xxxxx`.
Open that link to see the email as it would have looked to the
recipient.

Queue up as many emails as you like with `npm run add-job -- ...` — the
worker will keep polling and process them one after another.
