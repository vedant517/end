import nodemailer from "nodemailer";
import dns from "node:dns";

// Prefer IPv4 on Render, where IPv6 SMTP connections can fail or stall.
dns.setDefaultResultOrder("ipv4first");

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_TIMEOUT_MS = 15000;

let cachedTransporter = null;
let cachedTransportKey = "";

const parsePort = (value) => {
  const port = Number.parseInt(value, 10);
  return Number.isFinite(port) ? port : DEFAULT_SMTP_PORT;
};

const parseTimeout = (value) => {
  const timeout = Number.parseInt(value, 10);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_SMTP_TIMEOUT_MS;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const getSmtpConfig = () => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();
  const host = (process.env.SMTP_HOST || DEFAULT_SMTP_HOST).trim();
  const port = parsePort(process.env.SMTP_PORT);
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const timeoutMs = parseTimeout(process.env.SMTP_TIMEOUT_MS);
  const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || user).trim();

  return { user, pass, host, port, secure, timeoutMs, from };
};

const getTransporter = (config) => {
  const { user, pass, host, port, secure, timeoutMs } = config;
  if (!user || !pass) {
    throw new Error(
      "Email service is not configured. Set EMAIL_USER and EMAIL_PASS in .env"
    );
  }

  const transportKey = `${host}:${port}:${secure}:${user}`;
  if (cachedTransporter && cachedTransportKey === transportKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure,
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

const toEmailError = (err, config) => {
  const code = err?.code || err?.responseCode;
  const originalMessage = err?.message || "Failed to send OTP email.";

  if (code === "EAUTH" || /invalid login|authentication/i.test(originalMessage)) {
    return new Error(
      "Email login failed. For Gmail, use a 16-character App Password in EMAIL_PASS after enabling 2-Step Verification."
    );
  }

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "ECONNECTION" ||
    /timeout|timed out|connect/i.test(originalMessage)
  ) {
    return new Error(
      `Email server connection failed at ${config.host}:${config.port}. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and Render environment variables.`
    );
  }

  return new Error(originalMessage);
};

const withTimeout = (promise, timeoutMs, config) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Email server connection failed at ${config.host}:${config.port}. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and Render environment variables.`
        )
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

export const sendOtpEmail = async (to, otp) => {
  const config = getSmtpConfig();
  const transporter = getTransporter(config);

  try {
    await withTimeout(
      transporter.sendMail({
        from: config.from,
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
      }),
      config.timeoutMs,
      config
    );
  } catch (err) {
    throw toEmailError(err, config);
  }

  return true;
};
