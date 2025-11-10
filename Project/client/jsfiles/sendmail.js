import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

export async function sendEmail(email, mailSubject, body) {
  try {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: process.env.SMTP_EMAIL, // must be your verified sender
        subject: mailSubject,
        html: body,
      };

      await sgMail.send(msg);
      console.log("✅ Email sent successfully via SendGrid");
      return; // Stop here! No need to run fallback
    }

    // Fallback only if no SendGrid key
    const transport = nodemailer.createTransport({
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
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
}
