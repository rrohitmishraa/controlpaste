import { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { ref as dbRef, set, get, onDisconnect, remove } from "firebase/database";
import { database } from "../firebase";
import { useParams } from "react-router-dom";
import Header from "../components/Header";

const SESSION_STORAGE_KEY = "cp_session_id";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

async function fetchIpDetails() {
  try {
    const res = await fetch("https://ipwho.is/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch IP details:", err);
    return null;
  }
}

export default function LoadImage() {
  const { id } = useParams();
  const sessionId = getSessionId();

  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ===============================
     LOAD IMAGE
  ================================ */
  useEffect(() => {
    const fetchImage = async () => {
      try {
        const url = await getDownloadURL(ref(storage, `images/${id}`));
        setImageUrl(url);
      } catch (err) {
        console.error(err);
        setError("Failed to load image");
      } finally {
        setLoading(false);
      }
    };

    fetchImage();
  }, [id]);

  /* ===============================
     TRACK ACTIVE VIEWER
  ================================ */
  useEffect(() => {
    if (!imageUrl) return;

    const now = Date.now();
    const userRef = dbRef(database, `activeUsers/${sessionId}`);

    // Fetch IP details in the background (non-blocking, CORS-friendly)
    fetchIpDetails().then((details) => {
      const ip = details?.ip || null;
      const ipDetails = details || null;

      const userData = {
        imageId: id,
        imageUrl,
        startedAt: now,
        sessionId,
        ip,
        ipDetails,
      };

      // Mark as active. When the tab closes or connection drops, Firebase removes this automatically.
      set(userRef, userData).then(() => {
        onDisconnect(userRef).remove();
      });

      // Also log this view to history
      const logRef = dbRef(database, `viewLogs/${now}/${sessionId}`);
      set(logRef, {
        imageId: id,
        sessionId,
        ip,
        ipDetails,
        viewedAt: now,
      });
    });

    return () => {
      // Clean up when component unmounts (navigating away)
      remove(userRef).catch(() => {});
    };
  }, [imageUrl, id, sessionId]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      {/* IMAGE VIEWPORT */}
      <div
        className="
          flex-1
          flex
          items-center
          justify-center
          px-2 sm:px-4
        "
      >
        {loading && (
          <p className="text-sm sm:text-base text-gray-400">Loading image…</p>
        )}

        {error && <p className="text-sm sm:text-base text-red-500">{error}</p>}

        {!loading && !error && (
          <img
            src={imageUrl}
            alt=""
            decoding="async"
            className="
              max-w-full
              max-h-[90vh]
              object-contain
              select-none
            "
          />
        )}
      </div>
    </div>
  );
}
