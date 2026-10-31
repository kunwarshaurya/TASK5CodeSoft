import app from './app.js';
import config from './config/index.js';
import connectDB from './config/database.js';

const startServer = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`🚀 Online Quiz System API running on port ${config.port}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`📚 API Docs: http://localhost:${config.port}/api/v1/docs`);
    console.log(`❤️  Health: http://localhost:${config.port}/api/v1/health`);
  });
};

startServer();
