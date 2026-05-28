import nodemailer from "nodemailer";
import dns from "node:dns";

// Prefer IPv4 because some hosts fail or stall on IPv6 mail connections.
dns.setDefaultResultOrder("ipv4first");

const DEFAULT_TIMEOUT_MS = 15000;

let cachedTransporter = null;
let cachedTransportKey = "";

const parseTimeout = (value) => {
  const timeout = Number.parseInt(value, 10);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
};

const getEmailConfig = () => {
  const user = (process.env.EMAIL_USER || "").trim();
  const pass = (process.env.EMAIL_PASS || "").trim();
  const from = (process.env.EMAIL_FROM || user).trim();
  const timeoutMs = parseTimeout(process.env.EMAIL_TIMEOUT_MS);

  return { user, pass, from, timeoutMs };
};

const getTransporter = (config) => {
  const { user, pass, timeoutMs } = config;

  if (!user || !pass) {
    throw new Error(
      "Email service not configured. Set EMAIL_USER and EMAIL_PASS in environment variables."
    );
  }

  const transportKey = `gmail:${user}`;
  if (cachedTransporter && cachedTransportKey === transportKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    dnsTimeout: timeoutMs,
    family: 4,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
  cachedTransportKey = transportKey;

  return cachedTransporter;
};

const toEmailError = (err) => {
  const message = err?.message || "Failed to send OTP email.";
  const code = err?.code || err?.responseCode;

  if (code === "EAUTH" || /invalid login|authentication/i.test(message)) {
    return new Error(
      "Email login failed. For Gmail, use a valid 16-character App Password in EMAIL_PASS."
    );
  }

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "ECONNECTION" ||
    /socket|timeout|timed out|connect/i.test(message)
  ) {
    return new Error(
      "Gmail connection failed. Restart the backend, then check internet access and whether your hosting allows Gmail SMTP."
    );
  }

  return new Error(message);
};

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Gmail connection failed. Email request timed out."));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

export const sendOtpEmail = async (to, otp) => {
  const config = getEmailConfig();
  const transporter = getTransporter(config);

  try {
    await withTimeout(
      transporter.sendMail({
        from: `"Sheetalya" <${config.from}>`,
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
      }),
      config.timeoutMs
    );
  } catch (err) {
    throw toEmailError(err);
  }

  return true;
};
