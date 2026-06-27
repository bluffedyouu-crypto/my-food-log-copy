const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

let mongoClient = null;
let mongoDb = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/shredd";

  // Mongoose connection (for models)
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("✅ Mongoose connected to MongoDB");

  // Native MongoClient (for Better Auth)
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  mongoDb = mongoClient.db();
  console.log("✅ MongoClient connected for Better Auth");

  return { mongoClient, mongoDb };
}

function getMongoDb() {
  if (!mongoDb) throw new Error("MongoDB not connected. Call connectDB() first.");
  return mongoDb;
}

module.exports = { connectDB, getMongoDb };
