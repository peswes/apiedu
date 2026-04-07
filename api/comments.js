import { MongoClient } from "mongodb";

// Cache for serverless environments
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = client.db("edtechBlog");
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// Helper to set CORS headers
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  try {
    setCorsHeaders(res);

    // Handle preflight request
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { MONGO_URI } = process.env;
    if (!MONGO_URI) throw new Error("MONGO_URI not set in environment");

    const { db } = await connectToDatabase(MONGO_URI);

    let blogId = req.query.blogId;
    if (req.method === "POST" && !blogId) blogId = req.body.blogId;

    if (!blogId) return res.status(400).json({ error: "Missing blogId" });

    if (req.method === "GET") {
      const comments = await db
        .collection("comments")
        .find({ blogId })
        .sort({ createdAt: -1 })
        .toArray();
      return res.status(200).json(comments);
    }

    if (req.method === "POST") {
      const { name, message } = req.body;

      if (!name || !message || !name.trim() || !message.trim()) {
        return res.status(400).json({ error: "Name and message cannot be empty" });
      }

      const comment = {
        blogId,
        name: name.trim(),
        message: message.trim(),
        createdAt: new Date(),
      };

      await db.collection("comments").insertOne(comment);
      return res.status(201).json(comment);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error("Error in comments API:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}