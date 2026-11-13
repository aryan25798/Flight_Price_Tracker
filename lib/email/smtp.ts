import nodemailer from "nodemailer";

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: SendMailParams): Promise<boolean> {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn("SMTP credentials not configured. Skipping email dispatch.");
    return false;
  }

  const fromAddress = process.env.SMTP_FROM || `"AeroDrop Radar" <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ""),
    });
    return true;
  } catch (err) {
    console.error("Failed to send email via SMTP:", err);
    return false;
  }
}

/**
 * Superb 3D Glassmorphism Mobile-First Email Template for Tracker Activation
 */
export function buildTrackerCreatedEmail(params: {
  origin: string;
  destination: string;
  departureDate: string;
  targetPrice: number;
  currency: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AeroDrop Tracker Live</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: radial-gradient(circle at 50% 0%, #1e293b 0%, #060913 75%); padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- 3D Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 28px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(56,189,248,0.15); padding: 32px 24px;">
          <tr>
            <td align="center">
              <!-- Glow Badge -->
              <div style="display: inline-block; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.05)); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 9999px; margin-bottom: 20px;">
                ✈️ RADAR MONITOR ACTIVATED
              </div>

              <!-- Header -->
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Price Drop Tracker is Live
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                AeroDrop's automated engine is now scanning 100+ airlines and agencies every 4 hours for your route.
              </p>

              <!-- 3D Route Display Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 24px -8px rgba(0,0,0,0.5); padding: 22px; margin-bottom: 24px;">
                <tr>
                  <td align="center" style="font-size: 32px; font-weight: 900; color: #38bdf8; letter-spacing: 2px;">
                    ${params.origin} <span style="font-size: 24px; color: #64748b; font-weight: 400;">✈</span> ${params.destination}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 14px;">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8;">Departure Date</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #f1f5f9;">${params.departureDate}</td>
                      </tr>
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Target Alert Threshold</td>
                        <td align="right" style="font-size: 16px; font-weight: 800; color: #10b981; padding-top: 8px;">
                          ${params.currency} ${params.targetPrice.toLocaleString()}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 3D CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="http://localhost:3000/dashboard" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%); color: #04121e; font-size: 15px; font-weight: 800; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 14px; box-shadow: 0 5px 0 #0369a1, 0 12px 25px rgba(2, 132, 199, 0.45);">
                      VIEW LIVE RADAR IN DASHBOARD →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                You will receive instant alerts on your verified Telegram bot and email the moment fares hit or drop below this target.<br><br>
                © 2026 AeroDrop SaaS · Autonomous Flight Price Intelligence
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
