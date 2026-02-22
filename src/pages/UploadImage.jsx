import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { storage } from "../firebase";
import Header from "../components/Header";

export default function UploadImage() {
  const [images, setImages] = useState([]);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  /* ===============================
     ADD FILES
  ================================ */

  const addFiles = (fileList) => {
    const valid = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        stage: "idle",
        progress: 0,
        finalName: "",
      }));

    if (valid.length === 0) {
      setError("Only image files allowed");
      return;
    }

    setImages((prev) => [...prev, ...valid]);
    setError("");
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
  };

  /* ===============================
     PASTE SUPPORT
  ================================ */

  useEffect(() => {
    const handlePaste = (e) => {
      if (!e.clipboardData) return;

      const items = Array.from(e.clipboardData.items);
      const files = [];

      items.forEach((item) => {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      });

      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  /* ===============================
     GLOBAL DRAG & DROP
  ================================ */

  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  /* ===============================
     ANIMATION DETECTION
  ================================ */

  const isAnimatedGif = async (file) => {
    if (file.type !== "image/gif") return false;

    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);

    let frames = 0;
    for (let i = 0; i < view.length - 9; i++) {
      if (view[i] === 0x21 && view[i + 1] === 0xf9 && view[i + 2] === 0x04) {
        frames++;
        if (frames > 1) return true;
      }
    }
    return false;
  };

  /* ===============================
     PROCESS FILE
  ================================ */

  const processFile = async (file) => {
    const animated = await isAnimatedGif(file);

    if (animated) {
      return file; // preserve animation
    }

    return await imageCompression(file, {
      fileType: "image/webp",
      initialQuality: 0.85,
      useWebWorker: true,
    });
  };

  /* ===============================
     UPLOAD SINGLE
  ================================ */

  const uploadSingle = async (img) => {
    try {
      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, stage: "processing" } : i)),
      );

      const processedFile = await processFile(img.file);

      const fileName = `${Date.now()}`;

      const uploadTask = uploadBytesResumable(
        ref(storage, `images/${fileName}`),
        processedFile,
        { contentType: processedFile.type },
      );

      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, stage: "uploading" } : i)),
      );

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id ? { ...i, progress: Math.round(percent) } : i,
            ),
          );
        },
        () => setError("Upload failed"),
        async () => {
          await getDownloadURL(uploadTask.snapshot.ref);

          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id
                ? {
                    ...i,
                    stage: "done",
                    finalName: fileName,
                  }
                : i,
            ),
          );
        },
      );
    } catch {
      setError("Processing failed");
    }
  };

  const uploadAll = () => {
    images.forEach((img) => {
      if (img.stage === "idle") {
        uploadSingle(img);
      }
    });
  };

  const removeImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const copyLink = async (name) => {
    await navigator.clipboard.writeText("https://paste.unlinkly.com/" + name);
    setToast("Link copied");
    setTimeout(() => setToast(""), 2000);
  };

  /* ===============================
     UI
  ================================ */

  return (
    <div className="min-h-screen bg-gray-50 pb-[120px] relative">
      <Header page="home" />

      {/* FULL SCREEN DROP OVERLAY */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] bg-blue-600/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white shadow-2xl rounded-2xl px-10 py-8 text-center border border-blue-400">
            <p className="text-xl font-semibold text-blue-600">
              Drop images anywhere
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Drag & Drop • Paste • Or Select Images
            </p>
          </div>
        </div>
      )}

      <div className="max-w-[1000px] mx-auto px-4 mt-6">
        <div className="text-center text-gray-600 mb-6">
          Drag & Drop • Paste • Or Select Images
        </div>

        <div className="flex justify-center">
          <input
            type="file"
            id="fileInput"
            hidden
            multiple
            onChange={handleFileChange}
          />
          <label
            htmlFor="fileInput"
            className="px-6 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer"
          >
            Select Images
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
          {images.map((img) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative bg-white border rounded-xl p-2"
            >
              <img
                src={img.preview}
                alt=""
                className="w-full h-32 object-cover rounded-lg"
              />

              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full"
              >
                ✕
              </button>

              {img.stage === "uploading" && (
                <div className="text-xs mt-2">{img.progress}%</div>
              )}

              {img.stage === "done" && (
                <button
                  onClick={() => copyLink(img.finalName)}
                  className="text-xs mt-2 w-full bg-green-600 text-white py-1 rounded"
                >
                  Copy Link
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {images.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center">
          <button
            onClick={uploadAll}
            className="px-8 py-3 rounded-xl text-white bg-blue-600 hover:bg-blue-700"
          >
            Upload All
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/80 text-white text-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
