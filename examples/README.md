# Examples

Runnable examples of [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
in use. Each one is a self-contained npm project — `cd` into it, run
`npm install`, and follow its README.

| Example | Backend | What it shows |
| --- | --- | --- |
| [mp4-to-hls](./mp4-to-hls) | SQLite | Transcoding an uploaded video into HLS (`.m3u8` + `.ts`) with ffmpeg |
| [email-sending](./email-sending) | Redis | Sending email in the background with nodemailer |
| [csv-import](./csv-import) | Postgres | Streaming a CSV file and bulk-inserting its rows |
| [image-thumbnails](./image-thumbnails) | SQLite | Generating resized image thumbnails with sharp — the fastest one to try |
| [webhook-delivery](./webhook-delivery) | SQLite | Retrying failed HTTP deliveries with backoff, using the `fail`/`retry` hooks |
| [pdf-report-generation](./pdf-report-generation) | SQLite | Rendering a PDF invoice with pdfkit |

### Which one to start with

If you just want to see a job go from queued to completed as quickly as
possible, start with **image-thumbnails** — it needs no external
services and finishes in well under a second. **webhook-delivery** is
the one to read if you want to see the queue's hooks used for something
beyond logging (retry-with-backoff). The others each pair a use case
with the backend (`Queue`/Redis, `PostgresQueue`, `SQLiteQueue`) it
makes the most sense to try alongside.

### Common shape

Every example follows the same layout:

-   `src/queue.ts` — creates the queue (and runs any needed migrations)
-   `src/worker.ts` — a `Worker` subclass that does the actual work
-   `src/add-job.ts` — a CLI script to queue a job (`npm run add-job -- ...`)
-   `src/start-worker.ts` — starts the worker (`npm run worker`)

Each example's own README has the exact prerequisites and commands to
run it.
