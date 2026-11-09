import mongoose from "mongoose";

import { env } from "./env.js";

async function connectDB() {
  await mongoose.connect(env.MONGODB_URI);
}


export default connectDB