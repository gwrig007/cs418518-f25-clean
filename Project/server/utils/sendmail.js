import sgMail from "@sendgrid/mail";
import { createTransport } from "nodemailer";
import "dotenv/config";

// ✅ Universal email sender (SendGrid for production, Gmail for local)
export async function sendEmail(email, mailSubject, body) {
  try {
    // 1️⃣ Try SendGrid first (Render / production)
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: process.env.SMTP_EMAIL, // must be verified in SendGrid!
        subject: mailSubject,
        html: body,
      };

      await sgMail.send(msg);
      console.log("✅ Email sent successfully via SendGrid");
      return true;
    }

    // 2️⃣ Fallback: Gmail SMTP (local development)
    const transport = createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transport.sendMail({
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: mailSubject,
      html: body,
    });

    console.log("✅ Email sent successfully via Gmail SMTP");
    return true;
  } catch (err) {
    console.error("❌ Error sending email:", err.message || err);
    return false;
  }
}
