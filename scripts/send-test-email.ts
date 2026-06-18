import "dotenv/config";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@heliocare.health";

if (!apiKey) {
  console.error("❌ RESEND_API_KEY is not set in .env");
  process.exit(1);
}

const resend = new Resend(apiKey);

const to = "oshoarofavour@gmail.com";
const from = `Heliocare <${fromEmail}>`;

console.log(`📧 Sending test email to ${to} from ${from}...`);

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Hello from Heliocare ✨",
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #007bff;">Welcome to Heliocare</h1>
      <p>This is a test email to confirm that Resend is configured correctly.</p>
      <p>Your email integration is <strong>working!</strong> 🎉</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">- The Heliocare Team</p>
    </div>
  `,
  text: "Welcome to Heliocare!\n\nThis is a test email to confirm that Resend is configured correctly.\n\nYour email integration is working!\n\n- The Heliocare Team",
});

if (error) {
  console.error("❌ Failed to send:", error);
  process.exit(1);
}

console.log(`✅ Email sent successfully! (id: ${data?.id})`);
