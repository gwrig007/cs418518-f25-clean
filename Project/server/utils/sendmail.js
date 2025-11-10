import sgMail from "@sendgrid/mail";
import "dotenv/config";

// ✅ Always use SendGrid (Render-safe)
export async function sendEmail(email, mailSubject, body) {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("Missing SENDGRID_API_KEY in environment variables");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: process.env.SMTP_EMAIL, // must be a verified sender in SendGrid
      subject: mailSubject,
      html: body,
    };

    await sgMail.send(msg);
    console.log("✅ Email sent successfully via SendGrid");
    return true;
  } catch (err) {
    console.error("❌ Error sending email:", err.message || err);
    return false;
  }
}
r