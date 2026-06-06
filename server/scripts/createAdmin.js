require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const readline = require('readline');
const User = require('../models/User');

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
};

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/btechhelpline';
    await mongoose.connect(mongoUri);
    console.log('Database connected successfully.');

    let email = '';
    let name = '';
    let phone = '';
    let password = '';

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      console.log('\n--- BtechHelpline Secure Admin Seeding ---');
      
      email = await askQuestion('Enter Admin Email [admin@btechhelpline.com]: ');
      if (!email) email = 'admin@btechhelpline.com';

      name = await askQuestion('Enter Admin Name [System Administrator]: ');
      if (!name) name = 'System Administrator';

      phone = await askQuestion('Enter Admin Phone [9999999999]: ');
      if (!phone) phone = '9999999999';

      password = await askQuestion('Enter Admin Password [Leave blank to generate secure random password]: ');
    } else {
      // Non-interactive fallback
      email = 'admin@btechhelpline.com';
      name = 'System Administrator';
      phone = '9999999999';
    }

    // Check if user already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log(`\nUser with email ${email} already exists in the database. Role: ${existingAdmin.role}`);
      process.exit(0);
    }

    let isGenerated = false;
    if (!password) {
      // Generate secure 12-character password that satisfies all security checks
      password = crypto.randomBytes(6).toString('hex') + 'A1!';
      isGenerated = true;
    }

    // Validate password rules (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      console.error('\nERROR: Password must be at least 8 characters long, contain 1 uppercase letter, 1 lowercase letter, and 1 number.');
      process.exit(1);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const adminUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
      isActive: true,
    });

    await adminUser.save();
    
    console.log('\n=========================================');
    console.log('🎉 ADMIN USER SEEDED SECURELY IN DATABASE!');
    console.log(`Name:     ${name}`);
    console.log(`Email:    ${email}`);
    console.log(`Phone:    ${phone}`);
    if (isGenerated) {
      console.log(`Password: ${password}   <-- [SAVE THIS SECURELY NOW]`);
    } else {
      console.log(`Password: [Custom password you entered]`);
    }
    console.log('=========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    process.exit(1);
  }
};

seedAdmin();
