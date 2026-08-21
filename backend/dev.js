const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Prevent server.js from auto-connecting to localhost MongoDB
process.env.NODE_ENV = 'test';
const app = require('./server');

(async () => {
  // Start MongoDB Memory Server
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  console.log(`[Dev] Starting In-Memory MongoDB at ${uri}`);

  // Connect Mongoose
  await mongoose.connect(uri);
  console.log('[Dev] ✅ Connected to Secure MongoDB (In-Memory)');

  // Start Express Server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Dev] ✅ Secure Backend running on port ${PORT}`);
  });
})();
