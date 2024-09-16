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
    <div className="flex flex-col h-screen">
      <div className="flex h-full w-full">
        <div className="w-3/12 bg-blue-300 p-10">
          <h1 className="text-2xl font-bold w-4/2 my-10">
            ControlPaste - Share images easily
          </h1>
          <p className="mb-6">Want to share an image?</p>
          <Link
            className="bg-white px-3 py-2 rounded active:bg-slate-300"
            to="/"
          >
            Click Here...
          </Link>
        </div>

        <div className="w-9/12 flex justify-center items-center">
          {loading ? (
            <p>Loading image...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <img src={imageUrl} alt="Loaded from Firebase" className="w-auto" />
          )}
        </div>
      </div>
    </div>
  );
}

export default LoadImage;
