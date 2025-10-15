// create-superadmin.js
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/YOUTH-INNOVATION-PORTAL";

async function createSuperAdmin(email, password, firstName, lastName) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("YOUTH-INNOVATION-PORTAL");
  const admins = db.collection("admins");

  const hashedPassword = await bcrypt.hash(password, 12);

  const superAdmin = {
    email,
    password: hashedPassword,
    firstName,
    lastName,
    profileComplete: true,
    verified: true,
    role: "superadmin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await admins.insertOne(superAdmin);
  console.log("Superadmin created with _id:", result.insertedId);
  await client.close();
}

// Usage: node create-superadmin.js email password firstName lastName
const [,, email, password, firstName, lastName] = process.argv;
if (!email || !password || !firstName || !lastName) {
  console.error("Usage: node create-superadmin.js email password firstName lastName");
  process.exit(1);
}
createSuperAdmin(email, password, firstName, lastName);