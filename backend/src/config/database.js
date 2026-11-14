import mongoose from "mongoose";

import { env } from "./env.js";

async function connectDB() {
  await mongoose.connect(env.MONGODB_URI);

  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

export default connectDB;
