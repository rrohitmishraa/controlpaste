import React, { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import "../App.css";
import { useParams } from "react-router-dom";
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
    <div className="flex md:flex-col flex-col-reverse justify-start items-center h-full">
      <Header />

      {/* Image Display Section */}
      <div className="w-full p-[5px] flex justify-center items-center md:h-[calc(100vh-80px)] h-[calc(80vh+15px)]">
        {loading ? (
          <p className="text-lg md:text-xl">Loading image...</p>
        ) : error ? (
          <p className="text-red-500 text-lg md:text-xl">{error}</p>
        ) : (
          <img
            src={imageUrl}
            alt="Loaded from Firebase"
            className="max-w-full max-h-full shadow-lg rounded-lg"
          />
        )}
      </div>
    </div>
  );
}

export default LoadImage;
