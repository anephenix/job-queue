# Example: MP4 to HLS transcoder

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to build a background job that transcodes an `.mp4` video file into an
Apple HTTP Live Streaming (HLS) rendition — a `.m3u8` playlist plus a set
of `.ts` segment files — using [ffmpeg](https://ffmpeg.org/).

It uses `SQLiteQueue`, so there's no need to run Redis or Postgres to try
it out; the queue is stored in a local `job-queue.db` file.

### How it works

-   `src/queue.ts` creates a `SQLiteQueue` called `hls-transcode`.
-   `src/worker.ts` defines a `Worker` subclass that, for each job, shells
    out to `ffmpeg` to convert the input `.mp4` file into HLS output.
-   `src/add-job.ts` is a small CLI script that adds a job to the queue
    for a given `.mp4` file.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

### Prerequisites

-   Node.js
-   [ffmpeg](https://ffmpeg.org/download.html) installed and available on
    your `PATH` (e.g. `brew install ffmpeg` on macOS)

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Put an `.mp4` file somewhere on disk (the `input/` folder is a handy
    place to keep it), then queue it for transcoding:

    ```shell
    npm run add-job -- input/my-video.mp4
    ```

2.  In another terminal, start the worker to process queued jobs:

    ```shell
    npm run worker
    ```

The worker will pick up the job, run ffmpeg, and write `index.m3u8` and
the `.ts` segment files to `output/my-video/`. You can serve that folder
with any static file server and play `index.m3u8` in an HLS-capable
player (e.g. Safari, or `ffplay output/my-video/index.m3u8`).

Queue up as many files as you like with `npm run add-job -- <path>` —
the worker will keep polling and process them one after another.
