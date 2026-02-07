import { useState, useEffect, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import Header from "../components/Header";

export default function UploadImage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [toast, setToast] = useState("");

  const generateButtonRef = useRef(null);

  /* ===============================
     FILE SELECT
  ================================ */
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith("image/")) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setError("");
    } else {
      setError("Please select a valid image file");
    }
  };

  /* ===============================
     PASTE SUPPORT
  ================================ */
  useEffect(() => {
    const handlePaste = (e) => {
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith("image/")) {
          const pasted = item.getAsFile();
          setFile(pasted);
          setPreview(URL.createObjectURL(pasted));
          setError("");
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  /* ===============================
     UPLOAD
  ================================ */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setError("Paste or select an image first");
      return;
    }

    setLoading(true);
    setError("");

    const uniqueName = Date.now().toString();
    setFileName(uniqueName);

    const uploadTask = uploadBytesResumable(
      ref(storage, `images/${uniqueName}`),
      file,
    );

    uploadTask.on(
      "state_changed",
      null,
      () => {
        setError("Failed to upload image");
        setLoading(false);
      },
      async () => {
        try {
          await getDownloadURL(uploadTask.snapshot.ref);
          setLoading(false);
        } catch {
          setError("Failed to retrieve image URL");
          setLoading(false);
        }
      },
    );
  };

  /* ===============================
     COPY LINK
  ================================ */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        "https://paste.unlinkly.com/" + fileName,
      );
      setToast("Link copied to clipboard");
      setTimeout(() => setToast(""), 2000);
    } catch {
      setError("Failed to copy link");
    }
  };

  /* ===============================
     ENTER KEY SUPPORT
  ================================ */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && generateButtonRef.current) {
        e.preventDefault();
        generateButtonRef.current.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-[96px]">
      <Header page="home" />

      {/* MAIN CONTENT */}
      <div className="max-w-[900px] mx-auto px-3 sm:px-4 mt-4 sm:mt-6">
        {/* PASTE / PREVIEW ZONE */}
        <div
          className="
            w-full
            min-h-[50vh]
            flex
            items-center
            justify-center
            border-2 border-dashed border-gray-300
            rounded-xl
            bg-white
            text-center
          "
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="
                max-w-full
                max-h-[70vh]
                object-contain
              "
            />
          ) : (
            <div className="space-y-2 px-4">
              <p className="text-base sm:text-lg font-medium text-gray-700">
                Paste an image
              </p>
              <p className="text-sm text-gray-500">
                or select one from your device
              </p>
            </div>
          )}
        </div>

        {/* FILE PICKER */}
        <div className="flex justify-center mt-5 sm:mt-6">
          <input
            type="file"
            id="fileInput"
            hidden
            onChange={handleFileChange}
          />
          <label
            htmlFor="fileInput"
            className="
              w-full sm:w-auto
              text-center
              px-6 py-3
              rounded-lg
              bg-gray-100
              text-gray-700
              hover:bg-gray-200
            "
          >
            Select image
          </label>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className="
            fixed
            bottom-[96px]
            left-1/2
            -translate-x-1/2
            z-40
            px-4 py-2
            rounded-lg
            bg-black/80
            text-white
            text-sm
            backdrop-blur-md
          "
        >
          {toast}
        </div>
      )}

      {/* BOTTOM ACTION BAR */}
      <div
        className="
          fixed bottom-0 left-0 right-0
          z-30
          bg-white/80
          backdrop-blur-xl
          border-t border-white/40
        "
      >
        <div className="flex flex-col items-center gap-2 px-4 py-3">
          {fileName && !loading && (
            <button
              onClick={copyToClipboard}
              className="
                w-full sm:w-auto
                text-sm
                px-4 py-2
                rounded-md
                bg-green-600
                text-white
              "
            >
              Copy link
            </button>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            ref={generateButtonRef}
            onClick={handleSubmit}
            disabled={loading}
            className="
              w-full sm:w-auto
              px-6 py-3
              rounded-xl
              text-white
              bg-blue-600
              hover:bg-blue-700
              disabled:opacity-50
              text-base
            "
          >
            {loading ? "Generating link…" : "Generate link"}
          </button>
        </div>
      </div>
    </div>
  );
}
