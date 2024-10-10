import React, { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import "../App.css";
import { Link, useParams } from "react-router-dom";
import Header from "../components/Header";

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
    <div className="flex flex-col justify-start items-center h-full">
      <Header />

      {/* Image Display Section */}
      <div className="w-full flex justify-center items-center p-6 md:p-10 pb-[80px] md:pb-[120px]">
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

      {/* Extra Section */}
      <div className="w-full bg-blue-600 py-[10px] md:py-[22px] flex flex-col fixed bottom-0 items-center justify-center">
        <Link
          className="bg-white px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-center"
          to="/"
        >
          Click here and share your own image
        </Link>
      </div>
    </div>
  );
}

export default LoadImage;
