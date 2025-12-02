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


/* =====================================================
   ✅ ADD THIS (DO NOT REMOVE EXISTING FUNCTION)
   This matches what advising.js imports
===================================================== */
export async function sendStatusEmail(to, status, term, message) {

  const subject = `Advising Plan ${status}`;

  const html = `
    <h2>ODU Advising Notification</h2>
    <p>Your advising plan has been reviewed.</p>

    <p><strong>Term:</strong> ${term}</p>
    <p><strong>Status:</strong> ${status}</p>

    <p><strong>Advisor Message:</strong></p>
    <p>${message || "No feedback provided."}</p>

    <br>
    <p>ODU Advising Portal</p>
  `;

  // reuse your existing SendGrid sender
  return await sendEmail(to, subject, html);
}
