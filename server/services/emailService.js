import logger from '../config/logger.js';

/**
 * Shared helper to send emails via Resend API
 */
async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('placeholder') || apiKey === '') {
    logger.warn(`[Email Service] Resend API key is not configured. Logging email contents instead:
    TO: ${to}
    SUBJECT: ${subject}
    BODY: ${text}`);
    return false;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'CrowdCity AI <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })
    });

    if (response.ok) {
      const result = await response.json();
      logger.info(`[Email Service] Email successfully delivered to ${to}. Subject: "${subject}". Resend ID: ${result.id}`);
      return true;
    } else {
      const errorText = await response.text();
      logger.error(`[Email Service] Failed to deliver email to ${to}. Resend HTTP Status: ${response.status}. Error: ${errorText}`);
      return false;
    }
  } catch (err) {
    logger.error(`[Email Service] Unexpected exception during email delivery to ${to}: %O`, err);
    return false;
  }
}

/**
 * Common HTML wrapper layout for minimal, clean, professional emails
 */
function getEmailHtmlWrapper(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #080B10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table {
      border-collapse: collapse !important;
    }
    @media screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 20px 10px !important;
      }
      .content-card {
        padding: 32px 24px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #080B10;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080B10; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="500" class="container" style="max-width: 500px; width: 100%;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 2px; line-height: 1; text-transform: uppercase;">
                    CrowdCity<span style="color: #3b82f6;">.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content Card -->
          <tr>
            <td class="content-card" style="background-color: #11161D; border: 1px solid #202731; border-radius: 8px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
              ${contentHtml}
              
              <!-- Footer / Sign-off -->
              <p style="margin: 32px 0 0 0; font-size: 14px; color: #9AA4B2; text-align: center;">
                Team CrowdCity
              </p>
            </td>
          </tr>
          
          <!-- Outer Footer -->
          <tr>
            <td align="center" style="padding: 24px 0 0 0;">
              <p style="margin: 0; font-size: 11px; color: #475569; text-align: center; line-height: 1.5;">
                This email was sent by CrowdCity. If you did not request this email, please ignore it.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Email Verification OTP Template
 */
export const sendVerificationOtpEmail = async (email, code) => {
  const subject = 'Verify your email address - CrowdCity';
  
  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
      Verify Email Address
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #cbd5e1; text-align: center; line-height: 1.5;">
      Use the following one-time verification code to verify your email address and complete registration.
    </p>
    <div style="background-color: #080B10; border: 1px solid #202731; border-radius: 4px; padding: 16px; margin: 24px 0; text-align: center;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 800; color: #3b82f6; letter-spacing: 6px; line-height: 1;">
        ${code}
      </span>
    </div>
    <p style="margin: 0; font-size: 13px; color: #9AA4B2; text-align: center; line-height: 1.5;">
      This code is valid for 5 minutes.
    </p>
  `;

  const html = getEmailHtmlWrapper('Verify Email', contentHtml);
  const text = `Verify Email Address\n\nUse the following one-time verification code to verify your email address and complete registration.\n\nCode: ${code}\n\nThis code is valid for 5 minutes.`;
  
  return sendResendEmail({ to: email, subject, html, text });
};

/**
 * 2. Login OTP Template
 */
export const sendLoginOtpEmail = async (email, code) => {
  const subject = 'Your sign-in verification code - CrowdCity';
  
  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
      Sign In Verification
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #cbd5e1; text-align: center; line-height: 1.5;">
      Use the following one-time verification code to sign in to your CrowdCity account.
    </p>
    <div style="background-color: #080B10; border: 1px solid #202731; border-radius: 4px; padding: 16px; margin: 24px 0; text-align: center;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 800; color: #3b82f6; letter-spacing: 6px; line-height: 1;">
        ${code}
      </span>
    </div>
    <p style="margin: 0; font-size: 13px; color: #9AA4B2; text-align: center; line-height: 1.5;">
      This code is valid for 5 minutes.
    </p>
  `;

  const html = getEmailHtmlWrapper('Sign In Verification', contentHtml);
  const text = `Sign In Verification\n\nUse the following one-time verification code to sign in to your CrowdCity account.\n\nCode: ${code}\n\nThis code is valid for 5 minutes.`;

  return sendResendEmail({ to: email, subject, html, text });
};

/**
 * 3. Password Reset Template
 */
export const sendResetPasswordEmail = async (email, token) => {
  const subject = 'Reset your password - CrowdCity';
  const appUrl = process.env.APP_URL || 'https://crowdcity.co.in';
  const resetLink = `${appUrl}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;
  
  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
      Reset Password
    </h1>
    <p style="margin: 0 0 32px 0; font-size: 14px; color: #cbd5e1; text-align: center; line-height: 1.5;">
      We received a request to reset your password. You can reset your password by clicking the button below.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#3b82f6" style="border-radius: 4px;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 4px; border: 1px solid #3b82f6; letter-spacing: -0.1px;">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 13px; color: #9AA4B2; text-align: center; line-height: 1.5;">
      This link is valid for 15 minutes. If you did not request this, you can safely ignore this email.
    </p>
  `;

  const html = getEmailHtmlWrapper('Reset Password', contentHtml);
  const text = `Reset Password\n\nWe received a request to reset your password. You can reset it using the link below:\n\n${resetLink}\n\nThis link is valid for 15 minutes.`;

  return sendResendEmail({ to: email, subject, html, text });
};

/**
 * 4. Welcome Email Template
 */
export const sendWelcomeEmail = async (email, fullName, userId = 'N/A') => {
  const subject = 'Welcome to CrowdCity';
  const appUrl = process.env.APP_URL || 'https://crowdcity.co.in';

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; letter-spacing: -0.5px; line-height: 1.25;">
      Welcome, ${fullName || 'Citizen'}
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #cbd5e1; text-align: center; line-height: 1.5; font-weight: 500;">
      Your account has been created successfully.
    </p>
    <p style="margin: 0 0 32px 0; font-size: 14px; color: #9AA4B2; text-align: center; line-height: 1.6;">
      You can now report civic issues, track complaint progress, and help improve your city through CrowdCity.
    </p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#3b82f6" style="border-radius: 4px;">
                <a href="${appUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 4px; border: 1px solid #3b82f6; letter-spacing: -0.1px;">
                  Open CrowdCity
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = getEmailHtmlWrapper('Welcome to CrowdCity', contentHtml);
  const text = `Welcome, ${fullName || 'Citizen'}!\n\nYour account has been created successfully.\n\nYou can now report civic issues, track complaint progress, and help improve your city through CrowdCity.\n\nOpen CrowdCity: ${appUrl}`;

  return sendResendEmail({ to: email, subject, html, text });
};
