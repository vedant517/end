import nodemailer from "nodemailer";

const getSmtpConfig = () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return { user, pass, host, port, secure };
};

export const sendOtpEmail = async (to, otp) => {
  const { user, pass, host, port, secure } = getSmtpConfig();

  if (!user || !pass) {
    throw new Error(
      "Email service is not configured. Set EMAIL_USER and EMAIL_PASS in .env"
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // Optional but helps with Render/Gmail connections
    family: 4, // Force IPv4 to prevent ENETUNREACH IPv6 errors on Render
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || user,
    to,
    subject: "Your Sheetalya login OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes. Do not share this code.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#85754E;margin:0 0 16px">Sheetalya Login</h2>
        <p style="color:#334155">Use this one-time password to sign in:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f172a">${otp}</p>
        <p style="color:#64748b;font-size:14px">Valid for 5 minutes. If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  return true;
};
