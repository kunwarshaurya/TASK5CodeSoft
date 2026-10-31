import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    console.error('   Copy .env.example to .env and fill in all required values.');
    process.exit(1);
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5003,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100),
  },
  authRateLimit: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : (parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10),
  },
  quiz: {
    defaultTimeLimitMinutes: parseInt(process.env.DEFAULT_QUIZ_TIME_LIMIT_MINUTES, 10) || 30,
    defaultPassingScore: parseFloat(process.env.DEFAULT_PASSING_SCORE) || 50,
    defaultNegativeMarkingPenalty: parseFloat(process.env.DEFAULT_NEGATIVE_MARKING_PENALTY) || 0.25,
    defaultMaxAttempts: parseInt(process.env.DEFAULT_MAX_ATTEMPTS, 10) || 1,
  },
  admin: {
    name: process.env.ADMIN_NAME || 'Quiz Admin',
    email: process.env.ADMIN_EMAIL || 'admin@quizsystem.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  },
};

export default config;
