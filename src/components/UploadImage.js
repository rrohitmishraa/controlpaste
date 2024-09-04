import React, { useState, useEffect, useRef } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage, database } from "../firebase"; // Import Realtime Database
import { ref as dbRef, set, get } from "firebase/database"; // Import Realtime Database functions
import "../App.css";

function UploadImage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [tip, setTip] = useState(
    "Tip: You can paste an image directly from your clipboard."
  );
  const [shortenedUrl, setShortenedUrl] = useState("");
  const [shortening, setShortening] = useState(false);

  const generateLinkButtonRef = useRef(null); // Reference to the generate link button

  // Handle file selection from file input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
      setError("");
    } else {
      setError("Please select a valid image file");
    }
  };

  // Handle image pasting from clipboard
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          setFile(file);
          setPreview(URL.createObjectURL(file));
          setError("");
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please Paste or Upload an Image");
      return;
    }

    setLoading(true);
    // Use milliseconds as the unique file name
    const uniqueFileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `images/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Optional: Track progress
      },
      (error) => {
        console.error("Upload error:", error); // Log the error during upload
        setError("Failed to upload image");
        setLoading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then((downloadURL) => {
            setUrl(downloadURL); // Log the download URL
            setLoading(false);
          })
          .catch((error) => {
            console.error("Error getting download URL:", error); // Log the error during URL retrieval
            setError("Failed to retrieve download URL");
            setLoading(false);
          });
      }
    );
  };

  // Handle copying to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link Copied");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Handle keydown event for the "Enter" key to trigger button click
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault(); // Prevent default form submission behavior
        if (generateLinkButtonRef.current) {
          generateLinkButtonRef.current.click(); // Trigger the button click
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="container">
      <div className="upload-container">
        <h1>Paste or Upload an Image</h1>
        <form onSubmit={handleSubmit}>
          <div className="buttons">
            <input
              type="file"
              id="fileInput"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <label htmlFor="fileInput">Upload Image</label>

            {url && (
              <span id="copyText" onClick={copyToClipboard}>
                {"Click here to copy the link"}
              </span>
            )}

            {error && <p className="error">{error}</p>}

            <button
              type="button"
              ref={generateLinkButtonRef}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Generating Link..." : "Generate Link"}
            </button>
          </div>

          <div className="preview-area">
            {preview ? (
              <img className="preview" src={preview} alt="Preview" />
            ) : (
              <h1>
                Copy & Paste <br /> or <br /> Upload an Image
              </h1>
            )}
          </div>
        </form>
      </div>

      <div className="other-half"></div>
    </div>
  );
}

export default UploadImage;
