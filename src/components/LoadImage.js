import React, { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import "../App.css";
import { Link, useParams } from "react-router-dom";

function LoadImage() {
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const param = useParams();

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const imageRef = ref(storage, "images/" + param.id);
        const url = await getDownloadURL(imageRef);
        setImageUrl(url);
        setLoading(false);
      } catch (err) {
        setError("Failed to load image");
        setLoading(false);
        console.error("Error fetching image:", err);
      }
    };

    fetchImage();
  }, []);

  return (
    <div className="flex flex-col min-h-screen md:flex-row">
      {/* Sidebar Section */}
      <div className="w-full md:w-3/12 bg-blue-300 p-6 md:p-10 flex flex-col items-center md:items-start justify-center">
        <h1 className="text-2xl md:text-4xl font-bold my-4 md:my-10 text-center md:text-left">
          ControlPaste - Share images easily
        </h1>
        <p className="mb-4 md:mb-6 text-center md:text-left">
          Want to share an image?
        </p>
        <Link
          className="bg-white px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-center"
          to="/"
        >
          Click Here...
        </Link>
      </div>

      {/* Image Display Section */}
      <div className="w-full md:w-9/12 flex justify-center items-center p-6 md:p-10 bg-gray-50">
        {loading ? (
          <p className="text-lg md:text-xl">Loading image...</p>
        ) : error ? (
          <p className="text-red-500 text-lg md:text-xl">{error}</p>
        ) : (
          <img
            src={imageUrl}
            alt="Loaded from Firebase"
            className="max-w-full h-auto shadow-lg rounded-lg"
          />
        )}
      </div>
    </div>
  );
}

export default LoadImage;
