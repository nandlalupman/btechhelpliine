const nodemailer = require('nodemailer');

let transporter;
const hasEmailCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASS;

if (hasEmailCredentials) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
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

exports.sendVerificationEmail = async (email, name, token) => {
  const url = `${FRONTEND_URL}/login.html?verifyToken=${token}`;
  
  const mailOptions = {
    from: `"BtechHelpline Support" <${process.env.EMAIL_USER || 'no-reply@btechhelpline.com'}>`,
    to: email,
    subject: 'Verify your BtechHelpline Account',
    text: `Hello ${name},\n\nThank you for registering at BtechHelpline.com.\n\nPlease verify your account by clicking the link below:\n${url}\n\nThis link will expire in 24 hours.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>Thank you for registering at BtechHelpline.com.</p><p>Please verify your account by clicking the link below:</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Verify Account</a></p><p>Or copy and paste this URL into your browser:</p><p>${url}</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (email, name, token) => {
  const url = `${FRONTEND_URL}/reset-password.html?resetToken=${token}`;

  const mailOptions = {
    from: `"BtechHelpline Support" <${process.env.EMAIL_USER || 'no-reply@btechhelpline.com'}>`,
    to: email,
    subject: 'Reset your BtechHelpline Password',
    text: `Hello ${name},\n\nYou requested a password reset.\n\nPlease reset your password by clicking the link below:\n${url}\n\nIf you did not request this, you can ignore this email.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>You requested a password reset.</p><p>Please reset your password by clicking the link below:</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#f43f5e;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a></p><p>Or copy and paste this URL into your browser:</p><p>${url}</p><br><p>If you did not request this, you can safely ignore this email.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendLeadConfirmation = async (email, name, leadId) => {
  const mailOptions = {
    from: `"BtechHelpline Support" <${process.env.EMAIL_USER || 'no-reply@btechhelpline.com'}>`,
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
  }

  const mailOptions = {
    from: `"BtechHelpline Support" <${process.env.EMAIL_USER || 'no-reply@btechhelpline.com'}>`,
    to: email,
    subject: `Counselling Status Updated: ${statusText}`,
    text: `Hello ${name},\n\nThe status of your B.Tech counselling request has been updated to: ${statusText}.\n\n${details}\n\nLog in to your dashboard for more details.\n\nBest regards,\nBtechHelpline team`,
    html: `<p>Hello ${name},</p><p>The status of your B.Tech counselling request has been updated to: <strong>${statusText}</strong>.</p><p>${details}</p><br><p>Log in to your dashboard to review updates.</p><br><p>Best regards,<br>BtechHelpline team</p>`,
  };

  return transporter.sendMail(mailOptions);
};
