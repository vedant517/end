import nodemailer from "nodemailer";
import dns from "dns";

// Force IPv4 — prevents ENETUNREACH IPv6 errors on Render
dns.setDefaultResultOrder("ipv4first");

export const sendOtpEmail = async (to, otp) => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  const host = (process.env.SMTP_HOST || "smtp-relay.brevo.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const from = (process.env.EMAIL_FROM || process.env.SMTP_FROM || user).trim();

  if (!user || !pass) {
    throw new Error(
      "Email service not configured. Set SMTP_USER and SMTP_PASS in environment variables."
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // false for port 587/2525 (STARTTLS), true for port 465 (SSL)
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: `"Sheetalya" <${from}>`,
    to,
    subject: "Your Sheetalya Verification OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes. Do not share this code.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fffdf7;border:1px solid #e8d9b5;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <h2 style="color:#85754E;margin:0;font-size:24px;letter-spacing:1px">Sheetalya</h2>
          <p style="color:#64748b;font-size:13px;margin:4px 0 0">Email Verification</p>
        </div>
        <p style="color:#334155;font-size:15px;margin:0 0 8px">Use this one-time password to complete your registration:</p>
        <div style="text-align:center;margin:24px 0;padding:20px;background:#fff;border:2px dashed #d4b86a;border-radius:12px">
          <p style="font-size:38px;font-weight:900;letter-spacing:10px;color:#0f172a;margin:0">${otp}</p>
        </div>
        <p style="color:#64748b;font-size:13px;margin:0;text-align:center">Valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
        <hr style="border:none;border-top:1px solid #f1e8d0;margin:24px 0"/>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return true;
};
