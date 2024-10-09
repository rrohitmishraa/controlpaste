import React, { useState, useEffect, useRef } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase"; // Import Realtime Database
import "../App.css";

function UploadImage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [fName, setFName] = useState("");

  const generateLinkButtonRef = useRef(null);

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

    setFName(uniqueFileName);

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
            setUrl(downloadURL);
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
      await navigator.clipboard.writeText(
        "https://paste.artalic.com/image/" + fName
        // "https://controlpaste.vercel.app/image/" + fName
      );
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
    <div className="flex flex-col min-h-screen h-auto md:flex-row">
      {/* Left section with form */}
      <div className="w-full md:w-1/2 flex flex-col px-6 py-8 md:px-0 md:py-0">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
          ControlPaste - Share Images Easily
        </h1>

        <form
          className="flex flex-col items-center w-full"
          onSubmit={handleSubmit}
        >
          {/* URL and Error Display */}
          <div className="flex flex-col justify-center items-center w-full mb-6">
            {url && (
              <span
                className="my-4 cursor-pointer text-blue-600 text-lg"
                id="copyText"
                onClick={copyToClipboard}
              >
                Click here to copy the link
              </span>
            )}
            {error && <p className="text-red-500 my-4 text-lg">{error}</p>}

            {/* Generate Link Button */}
            <button
              type="button"
              ref={generateLinkButtonRef}
              onClick={handleSubmit}
              disabled={loading}
              className="text-white bg-blue-600 rounded-md py-3 px-6 mb-6 active:bg-blue-800 w-full md:w-auto text-lg"
            >
              {loading ? "Generating Link..." : "Generate Link"}
            </button>
          </div>

          {/* Image Preview Section */}
          <div className="preview-area flex flex-col justify-center items-center w-full mb-6">
            {preview ? (
              <img
                className="max-w-full h-auto mb-4 rounded-lg"
                src={preview}
                alt="Preview"
              />
            ) : (
              <img
                className="max-w-full h-auto mb-4 rounded-lg"
                src={"../images/paste.png"}
                alt="Preview"
              />
            )}

            {/* File Input */}
            <div className="flex flex-col justify-center items-center w-full">
              <h1 className="text-xl md:text-2xl mb-4">Copy & Paste</h1>

              <input
                type="file"
                id="fileInput"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <label
                className="cursor-pointer text-white bg-blue-600 rounded-md py-3 px-6 active:bg-blue-800 mb-6 text-lg"
                htmlFor="fileInput"
              >
                Or Select an Image
              </label>
            </div>
          </div>
        </form>
      </div>

      {/* Right section with background */}
      <div className="w-full md:w-1/2 bg-blue-300 h-64 md:h-auto flex justify-center items-center">
        {/* Additional content could go here if necessary */}
      </div>
    </div>
  );
}

export default UploadImage;
