import nodemailer, { type Transporter } from "nodemailer";

let transporterPromise: Promise<Transporter> | null = null;

/*
 * Uses an Ethereal (https://ethereal.email) test account, created on the
 * fly, so this example can send email without needing a real SMTP server
 * or credentials. Nothing is delivered to a real inbox - each "sent"
 * email can be viewed via the preview URL that the worker logs to the
 * console.
 */
function getTransporter(): Promise<Transporter> {
	if (!transporterPromise) {
		transporterPromise = (async () => {
			const testAccount = await nodemailer.createTestAccount();
			return nodemailer.createTransport({
				host: "smtp.ethereal.email",
				port: 587,
				secure: false,
				auth: {
					user: testAccount.user,
					pass: testAccount.pass,
				},
			});
		})();
	}
	return transporterPromise;
}

export default getTransporter;
