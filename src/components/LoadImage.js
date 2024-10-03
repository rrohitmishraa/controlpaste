import React, { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase"; // Make sure this is your Firebase storage reference
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
      <div className="w-full md:w-3/12 bg-blue-300 p-6 md:p-10 flex flex-col items-center md:items-start">
        <h1 className="text-xl md:text-2xl font-bold my-4 md:my-10 text-center md:text-left">
          ControlPaste - Share images easily
        </h1>
        <p className="mb-4 md:mb-6 text-center md:text-left">
          Want to share an image?
        </p>
        <Link className="bg-white px-3 py-2 rounded active:bg-slate-300" to="/">
          Click Here...
        </Link>
      </div>

      <div className="w-full md:w-9/12 flex justify-center items-center p-4 md:p-0">
        {loading ? (
          <p>Loading image...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <img
            src={imageUrl}
            alt="Loaded from Firebase"
            className="max-w-full h-auto"
          />
        )}
      </div>
    </div>
  );
}

export default LoadImage;
