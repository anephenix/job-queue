import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type Job, Worker } from "@anephenix/job-queue";
import PDFDocument from "pdfkit";
import reportQueue from "./queue.ts";

type LineItem = { description: string; quantity: number; unitPrice: number };
type InvoiceData = { title: string; customer: string; items: LineItem[] };

type ReportJob = Job & {
	data: {
		inputPath: string;
		outputPath: string;
	};
};

const COLUMNS = [
	{ label: "Description", x: 50, width: 260 },
	{ label: "Qty", x: 310, width: 60 },
	{ label: "Unit price", x: 370, width: 80 },
	{ label: "Total", x: 450, width: 80 },
];
const PAGE_BOTTOM = 750;

function formatCurrency(amount: number): string {
	return `$${amount.toFixed(2)}`;
}

function renderInvoice(data: InvoiceData, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 50 });
		const stream = createWriteStream(outputPath);
		doc.pipe(stream);
		stream.on("finish", resolve);
		stream.on("error", reject);

		doc.fontSize(20).text(data.title);
		doc.moveDown(0.5);
		doc.fontSize(12).text(`Customer: ${data.customer}`);
		doc.moveDown(1.5);

		let y = doc.y;
		const drawRow = (values: string[], bold = false): void => {
			if (y > PAGE_BOTTOM) {
				doc.addPage();
				y = doc.y;
			}
			doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
			COLUMNS.forEach((column, index) => {
				doc.text(values[index], column.x, y, { width: column.width });
			});
			y += 20;
		};

		drawRow(
			COLUMNS.map((c) => c.label),
			true,
		);

		let grandTotal = 0;
		for (const item of data.items) {
			const total = item.quantity * item.unitPrice;
			grandTotal += total;
			drawRow([
				item.description,
				String(item.quantity),
				formatCurrency(item.unitPrice),
				formatCurrency(total),
			]);
		}

		y += 10;
		drawRow(["", "", "Grand total", formatCurrency(grandTotal)], true);

		doc.end();
	});
}

class ReportWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { inputPath, outputPath } = (job as ReportJob).data;

		try {
			console.log(`Rendering report ${inputPath} -> ${outputPath}`);
			const raw = await readFile(inputPath, "utf-8");
			const data = JSON.parse(raw) as InvoiceData;
			await mkdir(path.dirname(outputPath), { recursive: true });
			await renderInvoice(data, outputPath);
			console.log(`Finished rendering ${outputPath}`);
			await this.completeJob(job);
		} catch (err) {
			console.error(`Error rendering report ${inputPath}:`, err);
			await this.failJob(job);
		}
	}
}

const reportWorker = new ReportWorker(reportQueue);

export default reportWorker;
