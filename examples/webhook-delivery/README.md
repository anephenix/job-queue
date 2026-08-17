# Example: Webhook delivery with retries

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to deliver webhooks in the background, retrying with backoff when
delivery fails. Unlike the other examples, this one is built around the
queue's **hooks**, `fail` and `retry`, rather than just `add`/`take`.

It uses `SQLiteQueue`, so there's no need to run Redis or Postgres.

### How it works

-   `src/queue.ts` creates a `SQLiteQueue` called `webhook-delivery`,
    with hooks wired up on `fail` and `retry`:
    -   The `fail` hook fires whenever a delivery attempt fails. It looks
        up how many times that job has already failed and, if it hasn't
        used up its retry budget (3 attempts, with 1s / 3s / 8s delays),
        schedules a call to `queue.retry(job)` after the backoff delay.
        Once the budget is used up, it logs that it's giving up and
        leaves the job failed.
    -   The `retry` hook just logs that the job has been put back in the
        queue.
-   `src/worker.ts` defines a `Worker` subclass that POSTs the job's
    payload to its target URL, completing the job on a `2xx` response
    and failing it (triggering the hook above) otherwise.
-   `src/receiver.ts` is a small HTTP server standing in for a real
    webhook endpoint. It deliberately fails the first couple of requests
    it receives before succeeding, so you can see the retry/backoff path
    happen without needing a real flaky endpoint.
-   `src/add-job.ts` is a small CLI script that queues a webhook
    delivery.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

Job attempt counts are tracked in memory, scoped to the running worker
process — a production setup would persist that alongside the job so
retries survive a worker restart. The `fail`/`retry` hooks themselves
work identically on `Queue` (Redis) and `PostgresQueue`.

### Prerequisites

-   Node.js

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Start the (deliberately flaky) receiver:

    ```shell
    npm run receiver
    ```

2.  In another terminal, queue a webhook delivery to it:

    ```shell
    npm run add-job -- http://localhost:4000/webhook '{"event":"user.created","userId":42}'
    ```

3.  In a third terminal, start the worker:

    ```shell
    npm run worker
    ```

You'll see the first two delivery attempts fail, with the worker
logging that it's retrying after a backoff delay each time, and the
third attempt succeed and complete the job. Watch the receiver's
terminal too — it logs every request it gets, and which ones it's
rejecting.

To see a job give up entirely, make the receiver fail more requests
than there are retries for:

```shell
FAIL_FIRST_N=10 npm run receiver
```

Queue another webhook and start the worker — after 3 failed retries
you'll see `Giving up` logged, and the job stays in the `failed` state.
