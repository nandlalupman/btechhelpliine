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

exports.sendVerificationEmail = async (email, name, token, baseUrl) => {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/login.html?verifyToken=${token}`;
  
  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Verify your BtechHelpline Account',
    text: `Hello ${name},\n\nThank you for registering at BtechHelpline.com.\n\nPlease verify your account by clicking the link below:\n${url}\n\nThis link will expire in 24 hours.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>Thank you for registering at BtechHelpline.com.</p><p>Please verify your account by clicking the link below:</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Verify Account</a></p><p>Or copy and paste this URL into your browser:</p><p>${url}</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendVerificationOTPEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Your BtechHelpline Email Verification OTP',
    text: `Hello ${name},\n\nYour one-time verification code is ${otp}.\n\nThis OTP is valid for 10 minutes.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>Your one-time verification code is <strong>${otp}</strong>.</p><p>This OTP is valid for 10 minutes.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (email, name, token, baseUrl) => {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const url = `${base}/reset-password.html?resetToken=${token}`;

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Reset your BtechHelpline Password',
    text: `Hello ${name},\n\nYou requested a password reset.\n\nPlease reset your password by clicking the link below:\n${url}\n\nIf you did not request this, you can ignore this email.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>You requested a password reset.</p><p>Please reset your password by clicking the link below:</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#f43f5e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p><p>Or copy and paste this URL into your browser:</p><p>${url}</p><br><p>If you did not request this, you can safely ignore this email.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};


exports.sendLeadConfirmation = async (email, name, leadId) => {
  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: 'Consultation Request Received',
    text: `Hello ${name},\n\nWe have received your B.Tech admission counselling request (ID: ${leadId}).\n\nOne of our expert counsellors will contact you on your registered phone number shortly.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>We have received your B.Tech admission counselling request (ID: <strong>${leadId}</strong>).</p><p>One of our expert counsellors will contact you on your registered phone number shortly.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendStatusUpdateEmail = async (email, name, status) => {
  let statusText = 'updated';
  let details = 'Our team is working on your query.';

  if (status === 'contacted') {
    statusText = 'Contacted';
    details = 'A counsellor has reviewed your details and will call you soon.';
  } else if (status === 'in_progress') {
    statusText = 'In Progress';
    details = 'Your counselling application is currently being matched with suitable colleges.';
  } else if (status === 'counselled') {
    statusText = 'Completed';
    details = 'Your counselling session is complete. You can view your recommended options on your dashboard.';
  } else if (status === 'cancelled') {
    statusText = 'Cancelled';
    details = 'Your consultation request has been successfully cancelled.';
  } else if (status === 'closed') {
    statusText = 'Closed';
    details = 'Your consultation request has been marked as closed.';
  } else if (status === 'dropped') {
    statusText = 'Dropped';
    details = 'Your consultation request has been marked as dropped.';
  }

  const mailOptions = {
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: email,
    subject: `Counselling Status Updated: ${statusText}`,
    text: `Hello ${name},\n\nThe status of your B.Tech counselling request has been updated to: ${statusText}.\n\n${details}\n\nLog in to your dashboard for more details.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>The status of your B.Tech counselling request has been updated to: <strong>${statusText}</strong>.</p><p>${details}</p><br><p>Log in to your dashboard to review updates.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};
