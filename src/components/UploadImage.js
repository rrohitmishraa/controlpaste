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
        "https://controlpaste.vercel.app/image/" + fName
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
    <div className="flex min-h-screen h-full">
      <div className="w-1/2 flex flex-col">
        <h1 className="text-5xl font-bold w-4/2 text-center mt-10">
          ControlPaste - Share images easily
        </h1>
        <form
          className="flex flex-col justify-center items-center h-full"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col">
            <div className="flex flex-col justify-center items-center">
              {url && (
                <span
                  className="my-5 cursor-pointer"
                  id="copyText"
                  onClick={copyToClipboard}
                >
                  {"Click here to copy the link"}
                </span>
              )}

              {error && <p className="my-5 text-red-500">{error}</p>}

              <button
                type="button"
                ref={generateLinkButtonRef}
                onClick={handleSubmit}
                disabled={loading}
                className="text-white bg-blue-600 rounded-md py-2 px-5 active:bg-blue-800"
              >
                {loading ? "Generating Link..." : "Generate Link"}
              </button>
            </div>
          </div>

          <div className="preview-area">
            {preview ? (
              <img className="preview" src={preview} alt="Preview" />
            ) : (
              <div>
                <img
                  className="preview"
                  src={"../images/paste.png"}
                  alt="Preview"
                />
              </div>
            )}

            <div className="flex flex-col justify-center items-center">
              <h1 className="text-2xl mb-4 mt-4">Copy & Paste</h1>

              <input
                type="file"
                id="fileInput"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <label
                className="cursor-pointer text-white bg-blue-600 rounded-md py-2 px-5 active:bg-blue-800"
                htmlFor="fileInput"
              >
                Or Select an Image
              </label>
            </div>
          </div>
        </form>
      </div>

      <div className="w-1/2 bg-blue-300"></div>
    </div>
  );
}

export default UploadImage;
