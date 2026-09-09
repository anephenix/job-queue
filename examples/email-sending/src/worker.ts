import { type Job, Worker } from "@anephenix/job-queue";
import nodemailer from "nodemailer";
import getTransporter from "./mailer.ts";
import emailQueue from "./queue.ts";

type EmailJob = Job & {
	data: {
		to: string;
		subject: string;
		text: string;
	};
};

class EmailWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { to, subject, text } = (job as EmailJob).data;

		try {
			const transporter = await getTransporter();
			const info = await transporter.sendMail({
				from: '"Job Queue Example" <example@job-queue.local>',
				to,
				subject,
				text,
			});
			console.log(`Sent email to ${to}: ${subject}`);
			console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
			await this.completeJob(job);
		} catch (err) {
			console.error(`Error sending email to ${to}:`, err);
			await this.failJob(job);
		}
	}
}

const emailWorker = new EmailWorker(emailQueue);

export default emailWorker;
