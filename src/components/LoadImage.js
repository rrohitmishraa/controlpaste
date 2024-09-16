import React, { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase"; // Make sure this is your Firebase storage reference
import "../App.css";
import { useParams } from "react-router-dom";

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
    <div className="flex flex-col justify-center items-center">
      {loading ? (
        <p>Loading image...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <img src={imageUrl} alt="Loaded from Firebase" className="w-1/2" />
      )}
    </div>
  );
}

export default LoadImage;
