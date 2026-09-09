# Example: PDF report generation

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to render a PDF report in the background rather than blocking a web
request while the document is generated. It uses
[pdfkit](https://pdfkit.org/) and `SQLiteQueue`, so there's no need to
run Redis or Postgres, and nothing beyond `npm install` is needed to
try it out (no headless browser to download, unlike an HTML-to-PDF
approach such as puppeteer).

The sample report is a simple invoice, but the same shape applies to
any CPU-bound "take some data, produce a document" job — statements,
certificates, exports, and so on.

### How it works

-   `src/queue.ts` creates a `SQLiteQueue` called `pdf-report-generation`.
-   `src/worker.ts` defines a `Worker` subclass that reads the JSON
    input named in the job, lays out an invoice (header, line item
    table, grand total, with pagination if it runs long) with `pdfkit`,
    and writes it to the output path named in the job.
-   `src/add-job.ts` is a small CLI script that queues a report for
    generation from a JSON file.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

The input JSON is expected to look like `sample/invoice.json`:

```json
{
	"title": "Invoice #1042",
	"customer": "Acme Corp",
	"items": [
		{ "description": "Consulting services", "quantity": 10, "unitPrice": 150 }
	]
}
```

### Prerequisites

-   Node.js

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Queue the sample invoice for rendering:

    ```shell
    npm run add-job -- sample/invoice.json
    ```

2.  In another terminal, start the worker to process queued jobs:

    ```shell
    npm run worker
    ```

The worker will pick up the job and write `output/invoice.pdf`,
containing the invoice header, an itemised table and the grand total.

Queue up as many reports as you like with `npm run add-job -- <path>` —
the worker will keep polling and process them one after another.
