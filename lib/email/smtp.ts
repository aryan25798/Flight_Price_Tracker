import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/utils";

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function getTransporter() {
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
  const transporter = getTransporter();
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
      text: text || "Please open this email in an HTML-compatible client.",
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
  dashboardUrl?: string;
}) {
  const baseUrl = getAppUrl();
  const ctaUrl =
    params.dashboardUrl ||
    `${baseUrl}/dashboard?origin=${encodeURIComponent(params.origin)}&destination=${encodeURIComponent(params.destination)}`;

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
                AeroDrop's automated engine is now scanning top airlines and agencies every 4 hours for your route.
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
                    <a href="${ctaUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%); color: #04121e; font-size: 15px; font-weight: 800; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 14px; box-shadow: 0 5px 0 #0369a1, 0 12px 25px rgba(2, 132, 199, 0.45);">
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

/**
 * Superb 3D Glassmorphism Mobile-First Email Template for Urgent Price Drop Notifications
 */
export function buildPriceDropEmail(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  airline?: string;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  bookingUrl?: string;
  dashboardUrl?: string;
}) {
  const baseUrl = getAppUrl();
  const ctaUrl =
    params.dashboardUrl ||
    `${baseUrl}/dashboard?origin=${encodeURIComponent(params.origin)}&destination=${encodeURIComponent(params.destination)}`;

  const savings = Math.max(0, params.targetPrice - params.currentPrice);
  const discountPct = params.targetPrice > 0 ? Math.round((savings / params.targetPrice) * 100) : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 Price Drop Alert: ${params.origin} → ${params.destination}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: radial-gradient(circle at 50% 0%, #1e293b 0%, #060913 75%); padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- 3D Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 28px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(239,68,68,0.2); padding: 32px 24px;">
          <tr>
            <td align="center">
              <!-- Urgent Glow Badge -->
              <div style="display: inline-block; background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.1)); border: 1px solid rgba(239, 68, 68, 0.5); color: #f87171; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 9999px; margin-bottom: 20px;">
                🚨 HURRY UP! PRICE DROP ALERT
              </div>

              <!-- Header -->
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                Fare Dropped Below Your Target!
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                Hurry! Flight price is now <strong>LESS</strong> than your target alert price. Book immediately before fares rebound or seats sell out.
              </p>

              <!-- Route Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 22px; margin-bottom: 24px;">
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
                      ${
                        params.airline
                          ? `<tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Airline</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #38bdf8; padding-top: 8px;">${params.airline}</td>
                      </tr>`
                          : ""
                      }
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Current Lowest Fare</td>
                        <td align="right" style="font-size: 20px; font-weight: 900; color: #10b981; padding-top: 8px;">
                          ${params.currency} ${params.currentPrice.toLocaleString()} 🔥
                        </td>
                      </tr>
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Target Alert</td>
                        <td align="right" style="font-size: 14px; font-weight: 600; color: #94a3b8; padding-top: 8px;">
                          ${params.currency} ${params.targetPrice.toLocaleString()}
                        </td>
                      </tr>
                      ${
                        discountPct > 0
                          ? `<tr>
                        <td align="left" style="font-size: 13px; color: #10b981; padding-top: 8px; font-weight: 700;">Below Target By</td>
                        <td align="right" style="font-size: 14px; font-weight: 800; color: #10b981; padding-top: 8px;">
                          ${params.currency} ${savings.toLocaleString()} (${discountPct}% OFF)
                        </td>
                      </tr>`
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Buttons -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 20px;">
                ${
                  params.bookingUrl && params.bookingUrl.startsWith("https://")
                    ? `<tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${params.bookingUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 14px; box-shadow: 0 5px 0 #047857, 0 12px 25px rgba(16, 185, 129, 0.45);">
                      BOOK LOWEST FARE DIRECTLY NOW →
                    </a>
                  </td>
                </tr>`
                    : ""
                }
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%); color: #04121e; font-size: 14px; font-weight: 800; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 14px; box-shadow: 0 5px 0 #0369a1, 0 10px 20px rgba(2, 132, 199, 0.35);">
                      OPEN LIVE RADAR IN DASHBOARD
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Fares change rapidly based on real-time airline seat inventory. If price rebounds, your tracker remains active.<br><br>
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

/**
 * Superb 3D Glassmorphism Mobile-First Email Template for 4-Hour Routine Radar Updates
 */
export function buildRoutineStatusUpdateEmail(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  airline?: string;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  bookingUrl?: string;
  dashboardUrl?: string;
}) {
  const baseUrl = getAppUrl();
  const ctaUrl =
    params.dashboardUrl ||
    `${baseUrl}/dashboard?origin=${encodeURIComponent(params.origin)}&destination=${encodeURIComponent(params.destination)}`;

  const diff = params.currentPrice - params.targetPrice;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⏱️ Flight Status: ${params.origin} → ${params.destination}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060913; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: radial-gradient(circle at 50% 0%, #1e293b 0%, #060913 75%); padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- 3D Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 28px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.1); padding: 32px 24px;">
          <tr>
            <td align="center">
              <!-- Radar Scheduled Badge -->
              <div style="display: inline-block; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.05)); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 16px; border-radius: 9999px; margin-bottom: 20px;">
                ⏱️ 4-HOUR RADAR SCAN UPDATE
              </div>

              <!-- Header -->
              <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Active Route Scan Complete
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                AeroDrop scanned 100+ airline catalogs and travel agencies in our latest 4-hour cycle. Here is your current fare breakdown:
              </p>

              <!-- Route Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 22px; margin-bottom: 24px;">
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
                      ${
                        params.returnDate
                          ? `<tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Return Date</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #f1f5f9; padding-top: 8px;">${params.returnDate}</td>
                      </tr>`
                          : ""
                      }
                      ${
                        params.airline
                          ? `<tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Lowest Airline Rate</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #38bdf8; padding-top: 8px;">${params.airline}</td>
                      </tr>`
                          : ""
                      }
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Current Lowest Fare</td>
                        <td align="right" style="font-size: 18px; font-weight: 800; color: #38bdf8; padding-top: 8px;">
                          ${params.currency} ${params.currentPrice.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Your Target Alert</td>
                        <td align="right" style="font-size: 14px; font-weight: 600; color: #94a3b8; padding-top: 8px;">
                          ${params.currency} ${params.targetPrice.toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td align="left" style="font-size: 13px; color: #94a3b8; padding-top: 8px;">Status</td>
                        <td align="right" style="font-size: 13px; font-weight: 700; color: ${diff <= 0 ? "#10b981" : "#f59e0b"}; padding-top: 8px;">
                          ${diff <= 0 ? "🔥 At or Below Target!" : `${params.currency} ${diff.toLocaleString()} above target`}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Buttons -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 20px;">
                ${
                  params.bookingUrl && params.bookingUrl.startsWith("https://")
                    ? `<tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${params.bookingUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%); color: #04121e; font-size: 14px; font-weight: 800; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 14px; box-shadow: 0 4px 0 #0369a1, 0 10px 20px rgba(2, 132, 199, 0.4);">
                      BOOK CURRENT FARE ON SELLER SITE →
                    </a>
                  </td>
                </tr>`
                    : ""
                }
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.08); color: #f1f5f9; font-size: 14px; font-weight: 700; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.15);">
                      OPEN LIVE RADAR IN DASHBOARD
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                AeroDrop scans every 4 hours automatically. You will receive an instant flash alert the moment fares drop.<br><br>
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
