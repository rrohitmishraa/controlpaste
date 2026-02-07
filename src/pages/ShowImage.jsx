import { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useParams } from "react-router-dom";
import Header from "../components/Header";

export default function LoadImage() {
  const { id } = useParams();

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

  return (
    <div className="min-h-screen bg-black flex flex-col">
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
