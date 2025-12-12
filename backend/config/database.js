import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase() {
  const { MONGODB_URI } = process.env;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Please define it in your environment variables.");
  }

  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    const { host, name } = mongoose.connection;
    console.log(`✅ MongoDB connected: ${host}/${name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("⚠️ MongoDB disconnected. Retrying on next request...");
  });
}

export default connectDatabase;
