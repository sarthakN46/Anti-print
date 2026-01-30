import mongoose from 'mongoose';

const connectDB = async () => {
  // 1. Get the connection string from our Environment Variables (No Hardcoding!)
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('❌ FATAL ERROR: MONGO_URI is not defined in .env');
    process.exit(1); // Stop the app if config is missing
  }

  // 2. The Retry Logic
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Attempt connection
      const conn = await mongoose.connect(MONGO_URI);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return; // Success! Exit the loop.
    } catch (error) {
      retries++;
      console.error(`⚠️ MongoDB Connection Failed (Attempt ${retries}/${MAX_RETRIES})... Retrying in 5s.`);
      
      // Wait for 5 seconds before trying again
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  // 3. If we fail 5 times, we crash intentionally so Docker can restart the container
  console.error('❌ Could not connect to MongoDB after multiple attempts. Exiting.');
  process.exit(1);
};

export default connectDB;