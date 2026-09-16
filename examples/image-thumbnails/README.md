# Example: Image thumbnail generation

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to generate image thumbnails in the background using
[sharp](https://sharp.pixelplumbing.com/). It's a good "first job queue"
example — it uses `SQLiteQueue`, so there's no need to run Redis or
Postgres, and processing an image is quick, so you'll see a job go from
queued to completed in well under a second.

### How it works

-   `src/queue.ts` creates a `SQLiteQueue` called `image-thumbnails`. The
    queue is stored in a local `job-queue.db` file.
-   `src/worker.ts` defines a `Worker` subclass that, for each job,
    generates three resized `.webp` versions of the input image (small,
    medium, large).
-   `src/add-job.ts` is a small CLI script that adds a job to the queue
    for a given image file.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

### Prerequisites

-   Node.js

That's it — `sharp` ships prebuilt binaries, so no separate image
library needs to be installed.

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Put an image file somewhere on disk (the `input/` folder is a handy
    place to keep it), then queue it for thumbnail generation:

    ```shell
    npm run add-job -- input/my-photo.jpg
    ```

2.  In another terminal, start the worker to process queued jobs:

    ```shell
    npm run worker
    ```

The worker will pick up the job and write `small.webp`, `medium.webp`
and `large.webp` (200px, 500px and 1000px wide respectively, aspect
ratio preserved) to `output/my-photo/`.

Queue up as many images as you like with `npm run add-job -- <path>` —
the worker will keep polling and process them one after another.
