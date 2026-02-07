import { useState, useEffect, useRef } from "react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase"; // Import Realtime Database
import "../App.css";
import Header from "../components/Header";

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
    const uniqueFileName = `${Date.now()}`;
    const storageRef = ref(storage, `images/${uniqueFileName}`);
    // const storageRef = ref(storage, `images/kajukatli`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setFName(uniqueFileName);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Optional: Track progress
      },
      (error) => {
        console.error("Upload error:", error);
        setError("Failed to upload image");
        setLoading(false);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then((downloadURL) => {
            setUrl(downloadURL);
            setLoading(false);
            // copyToClipboard();
          })
          .catch((error) => {
            console.error("Error getting download URL:", error); // Log the error during URL retrieval
            setError("Failed to retrieve download URL");
            setLoading(false);
          });
      },
    );
  };

  // Handle copying to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard
        .writeText("https://paste.unlinkly.com/" + fName)
        .then(alert("Link Copied"));
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Handle keydown event for the "Enter" key to trigger button click
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (generateLinkButtonRef.current) {
          generateLinkButtonRef.current.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col h-full justify-center items-center">
      <Header page="home" />

      <form
        className="flex flex-col h-[calc(100vh-330px)] md:h-[calc(100vh-255px)] items-center p-[5px] w-screen"
        onSubmit={handleSubmit}
      >
        {/* Image Preview Section */}
        {preview ? (
          <img className="h-full mb-4 rounded-lg" src={preview} alt="Preview" />
        ) : (
          <img
            className="h-auto mb-4 rounded-lg"
            src={"../images/paste.png"}
            alt="Preview"
          />
        )}

        <div className="flex items-center justify-center">
          {/* File Input */}
          <h1 className="hidden md:block text-[14px] text-center md:text-[20px]">
            Copy & Paste
          </h1>

          <input
            type="file"
            id="fileInput"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <label
            className="hidden md:block cursor-pointer text-gray-600 border-2 border-gray-400 border-dashed rounded-[8px] md:hover:bg-gray-300 active:bg-gray-300 py-3 w-[180px] ml-[20px] text-center text-[16px]"
            htmlFor="fileInput"
          >
            Or Select an Image
          </label>

          <label
            className="md:hidden cursor-pointer text-gray-600 border-2 border-gray-400 border-dashed rounded-[8px] md:hover:bg-gray-300 active:bg-gray-300 py-3 w-[180px] ml-[20px] text-center text-[16px]"
            htmlFor="fileInput"
          >
            Tap to select an Image
          </label>
        </div>
      </form>

      {/* URL and Error Display */}
      <div className="flex flex-col justify-cente items-center w-full fixed bottom-0 left-0">
        {url && (
          <span
            className="bg-green-600 text-center text-white mb-[5px] py-[8px] px-[20px] text-[14px] cursor-pointer md:text-[16px] rounded-[10px]"
            id="copyText"
            onClick={copyToClipboard}
          >
            {/* {`https://paste.artalic.com/${fName}`} <br />  */}
            Click here to copy the link
          </span>
        )}
        {error && (
          <p className="bg-red-600 text-white px-[20px] py-[2px] text-[14px] md:text-[16px] md:mt-[35px] mt-[25px] mb-[5px] rounded-[20px]">
            {error}
          </p>
        )}

        {/* Generate Link Button */}
        <button
          type="button"
          ref={generateLinkButtonRef}
          onClick={handleSubmit}
          disabled={loading}
          className="text-blue-100 bg-blue-600 rounded-md py-3 mb-[5px] md:mb-[10px] active:bg-blue-800 md:hover:bg-blue-800 text-lg w-[240px]"
        >
          {loading ? "Generating Link..." : "Generate Link"}
        </button>
      </div>
    </div>
  );
}

export default UploadImage;
