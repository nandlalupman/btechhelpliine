const nodemailer = require('nodemailer');

let transporter;
const hasEmailCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASS;

if (hasEmailCredentials) {
  const mailConfig = {
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };

  if (process.env.EMAIL_SERVICE) {
    mailConfig.service = process.env.EMAIL_SERVICE;
  } else {
    mailConfig.host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    mailConfig.port = parseInt(process.env.EMAIL_PORT || '587', 10);
    mailConfig.secure = process.env.EMAIL_SECURE === 'true';
    mailConfig.tls = {
      rejectUnauthorized: false
    };
  }

  transporter = nodemailer.createTransport(mailConfig);
} else {
  // Graceful fallback for local development: logs emails to console
  transporter = {
    sendMail: async (options) => {
      console.log('\n==================================================');
      console.log('✉️  SIMULATED EMAIL LOG (No SMTP Credentials in .env)');
      console.log(`To:      ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('--------------------------------------------------');
      console.log(options.text);
      console.log('==================================================\n');
      return { messageId: 'simulated-12345' };
    },
  };
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@btechhelpline.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'BtechHelpline';

const getEmailWrapper = (title, preheader, bodyHtml) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
    }
    .header-bar {
      height: 6px;
      background: linear-gradient(90deg, #2563eb, #3b82f6);
    }
    .header {
      padding: 32px 32px 20px 32px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-img {
      display: block;
      margin: 0 auto;
      border: 0;
      height: 48px;
      max-height: 48px;
      font-family: 'Inter', sans-serif;
      font-size: 24px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px 32px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .text {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-container {
      background-color: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #1e293b;
      margin: 0;
    }
    .otp-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .btn-reset {
      background-color: #f43f5e;
      box-shadow: 0 4px 6px -1px rgba(244, 63, 94, 0.2);
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .footer {
      padding: 32px;
      text-align: center;
      background-color: #f8fafc;
      border-top: 1px solid #f1f5f9;
    }
    .footer-text {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 12px 0;
    }
    .footer-links {
      font-size: 12px;
      color: #94a3b8;
    }
    .footer-links a {
      color: #64748b;
      text-decoration: none;
      margin: 0 8px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .container {
        border-radius: 0;
        border-left: none;
        border-right: none;
      }
      .content {
        padding: 30px 20px;
      }
      .footer {
        padding: 24px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header-bar"></div>
      <div class="header">
        <a href="${FRONTEND_URL}" style="text-decoration: none; display: block;">
          <img class="logo-img" src="${FRONTEND_URL}/assets/logos/logo.png" alt="BtechHelpline">
        </a>
      </div>
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="footer">
        <p class="footer-text" style="font-weight: 600; color: #475569; font-size: 13px; margin-bottom: 8px;">Need help or have questions?</p>
        <p class="footer-text" style="margin-bottom: 24px; font-size: 13px;">
          Call: <a href="tel:+917300012345" style="color: #2563eb; text-decoration: none; font-weight: 600;">+91 73000 12345</a> &nbsp;|&nbsp; 
          WhatsApp: <a href="https://wa.me/917300012345?text=Hi%20I%20need%20help%20with%20B.Tech%20admission" style="color: #10b981; text-decoration: none; font-weight: 600;" target="_blank">Chat Now</a> &nbsp;|&nbsp; 
          Email: <a href="mailto:info@btechhelpline.com" style="color: #2563eb; text-decoration: none; font-weight: 600;">info@btechhelpline.com</a>
        </p>
        <p class="footer-text">© ${new Date().getFullYear()} BtechHelpline. All rights reserved.</p>
        <p class="footer-text" style="font-size: 11px; color: #94a3b8;">This is an automated transactional email. Please do not reply directly to this message.</p>
        <p class="footer-links">
          <a href="${FRONTEND_URL}/terms.html">Terms of Service</a> | 
          <a href="${FRONTEND_URL}/privacy.html">Privacy Policy</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

exports.sendVerificationEmail = async (email, name, token, baseUrl) => {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/login.html?verifyToken=${token}`;
  
  const title = 'Verify your BtechHelpline Account';
  const bodyHtml = `
    <h2 class="title">Verify Your Account</h2>
    <p class="text">Hello ${name},</p>
    <p class="text">Thank you for registering at BtechHelpline.com. To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
    <div class="btn-container">
      <a href="${url}" class="btn" target="_blank">Verify Account</a>
    </div>
    <p class="text" style="font-size: 13px; color: #64748b; margin-top: 24px;">If the button above does not work, copy and paste this URL into your browser:<br><a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p>
    <p class="text" style="font-size: 13px; color: #94a3b8; margin-top: 20px;">Note: This verification link will expire in 24 hours.</p>
  `;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: title,
    text: `Hello ${name},\n\nThank you for registering at BtechHelpline.com.\n\nPlease verify your account by clicking the link below:\n${url}\n\nThis link will expire in 24 hours.\n\nBest regards,\nBtechHelpline team`,
    html: getEmailWrapper(title, 'Verify your email address', bodyHtml),
  };

  return transporter.sendMail(mailOptions);
};

exports.sendVerificationOTPEmail = async (email, name, otp) => {
  const title = 'Your BtechHelpline Email Verification OTP';
  const bodyHtml = `
    <h2 class="title">Your Verification Code</h2>
    <p class="text">Hello ${name},</p>
    <p class="text">To complete your registration or verify your identity, please enter the following One-Time Password (OTP) in the app:</p>
    <div class="otp-container">
      <div class="otp-label">Verification Code</div>
      <div class="otp-code">${otp}</div>
    </div>
    <p class="text" style="font-weight: 500; color: #475569;">This OTP is valid for 10 minutes. Do not share this code with anyone.</p>
  `;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: title,
    text: `Hello ${name},\n\nYour one-time verification code is ${otp}.\n\nThis OTP is valid for 10 minutes.\n\nBest regards,\nBtechHelpline team`,
    html: getEmailWrapper(title, 'Verify your email address with OTP', bodyHtml),
  };

  return transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (email, name, token, baseUrl) => {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/reset-password.html?resetToken=${token}`;

  const title = 'Reset your BtechHelpline Password';
  const bodyHtml = `
    <h2 class="title" style="color: #f43f5e;">Reset Your Password</h2>
    <p class="text">Hello ${name},</p>
    <p class="text">We received a request to reset your BtechHelpline password. Click the button below to choose a new password:</p>
    <div class="btn-container">
      <a href="${url}" class="btn btn-reset" target="_blank">Reset Password</a>
    </div>
    <p class="text" style="font-size: 13px; color: #64748b; margin-top: 24px;">If the button above does not work, copy and paste this URL into your browser:<br><a href="${url}" style="color: #f43f5e; word-break: break-all;">${url}</a></p>
    <p class="text" style="font-size: 13px; color: #94a3b8; margin-top: 20px;">If you did not request a password reset, you can safely ignore this email—your password will remain unchanged.</p>
  `;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: title,
    text: `Hello ${name},\n\nYou requested a password reset.\n\nPlease reset your password by clicking the link below:\n${url}\n\nIf you did not request this, you can ignore this email.\n\nBest regards,\nBtechHelpline team`,
    html: getEmailWrapper(title, 'Reset your password', bodyHtml),
  };

  return transporter.sendMail(mailOptions);
};

exports.sendLeadConfirmation = async (email, name, leadId) => {
  const title = 'Consultation Request Received';
  const bodyHtml = `
    <h2 class="title">Consultation Request Received</h2>
    <p class="text">Hello ${name},</p>
    <p class="text">We have successfully received your B.Tech admission counselling request (ID: <strong>#${leadId}</strong>).</p>
    <p class="text">One of our expert counsellors will review your details and contact you on your registered phone number shortly to guide you through your college admissions.</p>
    <p class="text" style="font-weight: 500; color: #2563eb;">We are excited to help you find the best engineering branch and college for your rank!</p>
  `;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: title,
    text: `Hello ${name},\n\nWe have received your B.Tech admission counselling request (ID: ${leadId}).\n\nOne of our expert counsellors will contact you on your registered phone number shortly.\n\nBest regards,\nBtechHelpline team`,
    html: getEmailWrapper(title, 'Consultation request received', bodyHtml),
  };

  return transporter.sendMail(mailOptions);
};

exports.sendStatusUpdateEmail = async (email, name, status) => {
  let statusText = 'Updated';
  let details = 'Our team is working on your query.';
  let badgeColor = '#3b82f6';

  if (status === 'contacted') {
    statusText = 'Contacted';
    details = 'A counsellor has reviewed your details and will call you soon.';
    badgeColor = '#06b6d4';
  } else if (status === 'in_progress') {
    statusText = 'In Progress';
    details = 'Your counselling application is currently being matched with suitable colleges.';
    badgeColor = '#f59e0b';
  } else if (status === 'counselled') {
    statusText = 'Completed';
    details = 'Your counselling session is complete. You can view your recommended options on your dashboard.';
    badgeColor = '#10b981';
  } else if (status === 'cancelled') {
    statusText = 'Cancelled';
    details = 'Your consultation request has been successfully cancelled.';
    badgeColor = '#64748b';
  } else if (status === 'closed') {
    statusText = 'Closed';
    details = 'Your consultation request has been marked as closed.';
    badgeColor = '#475569';
  } else if (status === 'dropped') {
    statusText = 'Dropped';
    details = 'Your consultation request has been marked as dropped.';
    badgeColor = '#ef4444';
  }

  const title = `Counselling Status Updated: ${statusText}`;
  const bodyHtml = `
    <h2 class="title">Counselling Status Update</h2>
    <p class="text">Hello ${name},</p>
    <p class="text">The status of your B.Tech counselling request has been updated to:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; padding: 10px 24px; font-weight: 700; font-size: 16px; background-color: ${badgeColor}; color: #ffffff; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">${statusText}</span>
    </div>
    <p class="text">${details}</p>
    <p class="text" style="font-size: 14px; font-weight: 500; text-align: center; margin-top: 28px;">Log in to your dashboard to review updates and next steps.</p>
  `;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: title,
    text: `Hello ${name},\n\nThe status of your B.Tech counselling request has been updated to: ${statusText}.\n\n${details}\n\nLog in to your dashboard for more details.\n\nBest regards,\nBtechHelpline team`,
    html: getEmailWrapper(title, `Counselling status updated to ${statusText}`, bodyHtml),
  };

  return transporter.sendMail(mailOptions);
};
