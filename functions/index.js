const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

const db = getDatabase(undefined, "https://controlpaste.firebaseio.com");

exports.logVisit = onRequest(async (req, res) => {
  try {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const rawIp =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

    const ip = rawIp.split(",")[0].trim(); // first IP only

    const key = ip.replace(/[.#$\[\]]/g, "_"); // safe DB key
    const visitorRef = db.ref("visitors").child(key);

    const snapshot = await visitorRef.get();
    const now = Date.now();

    if (!snapshot.exists()) {
      // First time visitor
      await visitorRef.set({
        ip,
        firstVisit: now,
        visits: [now],
      });
    } else {
      // Only log timestamp
      await visitorRef.child("visits").push(now);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed" });
  }
});
