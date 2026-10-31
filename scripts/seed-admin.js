import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../src/models/User.js';

const seed = async () => {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGODB_URI) { console.error('❌ MONGODB_URI is required'); process.exit(1); }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD are required'); process.exit(1); }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log(`ℹ️  Admin user already exists: ${ADMIN_EMAIL}`);
  } else {
    await User.create({
      name: ADMIN_NAME || 'Quiz Admin',
      email: ADMIN_EMAIL.toLowerCase(),
      password: ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log(`✅ Admin user created: ${ADMIN_EMAIL}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => { console.error('❌ Seed error:', err.message); process.exit(1); });
