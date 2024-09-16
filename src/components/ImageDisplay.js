import React, { useState, useEffect } from "react";
import axios from "axios";
import "../App.css";

function ImageDisplay({ imageUrl }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        let imageUrl = "";
        const response = await axios.get(imageUrl, { responseType: "blob" });
        imageUrl = URL.createObjectURL(response.data);
        setImageSrc(imageUrl);
      } catch (error) {
        console.error("Error fetching image:", error);
        setError("Failed to load image");
      }
    };

    fetchImage();
  }, [imageUrl]);

  if (error) {
    return <p>{error}</p>;
  }

  return imageSrc ? <img src={imageSrc} alt="Uploaded" /> : <p>Loading...</p>;
}

export default ImageDisplay;
