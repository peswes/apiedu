import { MongoClient } from "mongodb";

// MongoDB connection cache (for serverless)
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

export default async function handler(req, res) {
  try {
    const { MONGO_URI } = process.env;
    const { db } = await connectToDatabase(MONGO_URI);

    let blogId = req.query.blogId;

    // For POST, allow blogId in body if missing from query
    if (req.method === "POST" && !blogId) {
      blogId = req.body.blogId;
    }

    if (!blogId) {
      return res.status(400).json({ error: "Missing blogId" });
    }

    if (req.method === "GET") {
      // Fetch comments for this blog
      const comments = await db
        .collection("comments")
        .find({ blogId })
        .sort({ createdAt: -1 })
        .toArray();
      return res.status(200).json(comments);
    }

    if (req.method === "POST") {
      const { name, message } = req.body;
      if (!name || !message)
        return res.status(400).json({ error: "Missing name or message" });

      const comment = {
        blogId,
        name,
        message,
        createdAt: new Date(),
      };

      await db.collection("comments").insertOne(comment);
      return res.status(201).json(comment);
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error("Error in comments API:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}