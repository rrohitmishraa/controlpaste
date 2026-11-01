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
      return res.status(204).send("");
    }

    /* ============================================================
       GET VISITOR IP
       ============================================================ */

    const forwardedFor = req.headers["x-forwarded-for"];

    const ip =
      forwardedFor ?
        forwardedFor.split(",")[0].trim()
      : req.socket.remoteAddress?.replace(/^::ffff:/, "") || "unknown";

    console.log("Visitor IP:", ip);
    console.log("X-Forwarded-For:", forwardedFor);

    const key = ip.replace(/[.#$\[\]/]/g, "_");
    const visitorRef = db.ref("visitors").child(key);

    const now = Date.now();

    /* ============================================================
       FETCH IP DETAILS
       ============================================================ */

    let ipDetails = null;

    // Do not attempt a lookup for local/private/unknown addresses.
    const canLookup =
      ip && ip !== "unknown" && ip !== "::1" && ip !== "127.0.0.1";

    if (canLookup) {
      try {
        const geoResponse = await fetch(
          `https://ipwho.is/${encodeURIComponent(ip)}`,
        );

        const geoData = await geoResponse.json();

        // IMPORTANT: Check exactly what the API returned.
        console.log("IP lookup response:", JSON.stringify(geoData, null, 2));

        if (geoResponse.ok && geoData.success !== false) {
          ipDetails = {
            country: geoData.country || null,
            countryCode: geoData.country_code || null,
            region: geoData.region || null,
            city: geoData.city || null,
            postal: geoData.postal || null,

            latitude: geoData.latitude ?? null,
            longitude: geoData.longitude ?? null,

            // ipwho.is stores connection information here.
            isp: geoData.connection?.isp || null,
            organization: geoData.connection?.org || null,

            timezone: geoData.timezone?.id || null,
          };

          console.log("Processed IP details:", ipDetails);
        } else {
          console.error(
            "IP lookup was unsuccessful:",
            geoData.message || geoData,
          );
        }
      } catch (geoError) {
        console.error("IP lookup request failed:", geoError);
      }
    }

    /* ============================================================
       SAVE VISITOR
       ============================================================ */

    const snapshot = await visitorRef.get();

    if (!snapshot.exists()) {
      await visitorRef.set({
        ip,
        ipDetails,
        firstVisit: now,
        lastVisit: now,
        visits: {
          [now]: true,
        },
      });
    } else {
      // Always update the latest visitor information.
      await visitorRef.update({
        ip,
        lastVisit: now,

        // Only replace details when the lookup succeeded.
        ...(ipDetails ? { ipDetails } : {}),
      });

      await visitorRef.child("visits").push(now);
    }

    return res.status(200).json({
      success: true,
      ip,
      ipDetails,
    });
  } catch (error) {
    console.error("logVisit failed:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
