import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, database } from "../firebase";
import { ref as dbRef, set, get, remove } from "firebase/database";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState({ id: "", password: "" });
  const [images, setImages] = useState([]); // { id, url, visible, displayName }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  const handleLogin = (e) => {
    e.preventDefault();
    if (
      credentials.id === process.env.REACT_APP_ADMIN_ID &&
      credentials.password === process.env.REACT_APP_ADMIN_PASSWORD
    ) {
      setLoggedIn(true);
      setError("");
    } else {
      setError("Invalid credentials");
    }
  };

  const [allIds, setAllIds] = useState([]);
  const [dbSettings, setDbSettings] = useState({});

  /* Load IDs and DB settings quickly */
  useEffect(() => {
    if (!loggedIn) return;

    const loadIdsAndSettings = async () => {
      setLoading(true);
      try {
        const rootRes = await listAll(ref(storage));
        const imagesFolder = rootRes.prefixes.find((p) => p.name === "images");
        if (!imagesFolder) {
          setAllIds([]);
          setImages([]);
          setLoading(false);
          return;
        }
        const imagesRes = await listAll(imagesFolder);
        const ids = imagesRes.items.map((i) => i.name);

        // Load DB settings
        const settingsSnap = await get(dbRef(database, "gallerySettings"));
        const settings = settingsSnap.exists() ? settingsSnap.val() : {};
        setDbSettings(settings);

        // Filter visible and sort pinned
        const visibleIds = ids.filter((id) => settings[id]?.visible !== false);
        const pinnedIds = visibleIds.filter((id) => settings[id]?.pinned === true);
        const unpinnedIds = visibleIds.filter((id) => settings[id]?.pinned !== true);
        const sortedIds = [...pinnedIds, ...shuffleArray(unpinnedIds)];
        setAllIds(sortedIds);
        setCurrentPage(1);
      } catch (err) {
        console.error(err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadIdsAndSettings();
  }, [loggedIn]);

  const toggleVisibility = async (id, current) => {
    const newVal = !current;
    await set(dbRef(database, `gallerySettings/${id}/visible`), newVal);
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, visible: newVal } : img))
    );
  };

  const togglePin = async (id, current) => {
    const newVal = !current;
    await set(dbRef(database, `gallerySettings/${id}/pinned`), newVal);
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, pinned: newVal } : img))
    );
  };

  /* Load URLs only for paginated images */
  useEffect(() => {
    if (!allIds.length) return;
    const loadPageUrls = async () => {
      const start = (currentPage - 1) * PAGE_SIZE;
      const pageIds = allIds.slice(start, start + PAGE_SIZE);
      const data = await Promise.all(
        pageIds.map(async (id) => {
          const url = await getDownloadURL(ref(storage, `images/${id}`));
          const settings = dbSettings[id] || {};
          return {
            id,
            url,
            visible: settings.visible !== false,
            pinned: settings.pinned === true,
            displayName: settings.displayName || id,
          };
        })
      );
      setImages(data);
    };
    loadPageUrls();
  }, [allIds, currentPage, dbSettings]);

  const updateDisplayName = async (id, name) => {
    await set(dbRef(database, `gallerySettings/${id}/displayName`), name);
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, displayName: name } : img))
    );
  };

  const downloadImage = (url, filename) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllAsZip = async () => {
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("images");
      const visibleIds = allIds.filter((id) => {
        const s = dbSettings[id] || {};
        return s.visible !== false;
      });
      for (const id of visibleIds) {
        const url = await getDownloadURL(ref(storage, `images/${id}`));
        const response = await fetch(url);
        const blob = await response.blob();
        const settings = dbSettings[id] || {};
        folder.file(settings.displayName || id, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "gallery-images.zip");
    } catch (err) {
      console.error(err);
      alert("Failed to create ZIP");
    } finally {
      setDownloadingAll(false);
    }
  };

  const deleteImage = async (id) => {
    if (!window.confirm(`Delete image ${id}?`)) return;
    try {
      await deleteObject(ref(storage, `images/${id}`));
      await remove(dbRef(database, `gallerySettings/${id}`));
      setImages((prev) => prev.filter((img) => img.id !== id));
      setSelectedIds((prev) => prev.filter((s) => s !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete image");
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected images?`)) return;
    for (const id of selectedIds) {
      try {
        await deleteObject(ref(storage, `images/${id}`));
        await remove(dbRef(database, `gallerySettings/${id}`));
      } catch (err) {
        console.error(err);
      }
    }
    setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));
    setSelectedIds([]);
  };

  const downloadSelected = async () => {
    if (selectedIds.length === 0) return;
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("images");
      for (const img of images.filter((i) => selectedIds.includes(i.id))) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        folder.file(img.displayName || img.id, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "selected-images.zip");
    } catch (err) {
      console.error(err);
      alert("Failed to create ZIP");
    } finally {
      setDownloadingAll(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-700"
        >
          <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Login</h1>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Admin ID"
              value={credentials.id}
              onChange={(e) =>
                setCredentials({ ...credentials, id: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              required
            />
            <input
              type="password"
              placeholder="Admin Password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          <button
            type="submit"
            className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition shadow-lg shadow-red-600/20"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  const totalPages = Math.ceil(images.length / PAGE_SIZE);
  const paginatedImages = images.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const paginationItems = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const items = [];
    items.push(1);
    if (currentPage > 3) items.push("ellipsis-start");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i !== 1 && i !== totalPages) items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("ellipsis-end");
    if (totalPages !== 1) items.push(totalPages);
    const seen = new Set();
    return items.filter((x) => { if (seen.has(x)) return false; seen.add(x); return true; });
  };

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedImages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedImages.map((img) => img.id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard — {images.length} images</h1>
          <label className="flex items-center gap-2 text-sm text-gray-600 mr-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paginatedImages.length > 0 && selectedIds.length === paginatedImages.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-red-600 rounded"
            />
            Select All
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={downloadSelected}
              disabled={downloadingAll || selectedIds.length === 0}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-30"
            >
              Download Selected ({selectedIds.length})
            </button>
            <button
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-30"
            >
              Delete Selected ({selectedIds.length})
            </button>
            <button
              onClick={downloadAllAsZip}
              disabled={downloadingAll}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              {downloadingAll ? "Zipping..." : "Download All (ZIP)"}
            </button>
            <button
              onClick={() => setLoggedIn(false)}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center text-gray-500 mt-8">Loading images...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedImages.map((img) => (
              <div
                key={img.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition ${
                  selectedIds.includes(img.id) ? "ring-2 ring-red-500 border-red-300" : "border-gray-200"
                }`}
              >
                <div className="relative">
                  <label className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur rounded-md shadow-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(img.id)}
                      onChange={() => toggleSelection(img.id)}
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </label>
                  <img
                    src={img.url}
                    alt={img.displayName}
                    loading="lazy"
                    className="w-full h-48 object-contain bg-gray-50"
                  />
                  <span
                    className={`absolute top-3 left-3 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                      img.visible
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {img.visible ? "Visible" : "Hidden"}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={img.displayName}
                      onChange={(e) => updateDisplayName(img.id, e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400 font-mono truncate">{img.id}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => togglePin(img.id, img.pinned)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        img.pinned
                          ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      {img.pinned ? "Pinned" : "Pin"}
                    </button>
                    <button
                      onClick={() => toggleVisibility(img.id, img.visible)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        img.visible
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      }`}
                    >
                      {img.visible ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => downloadImage(img.url, img.displayName || img.id)}
                      className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30"
              >
                Prev
              </button>
              {paginationItems().map((item, idx) => {
                if (item === "ellipsis-start" || item === "ellipsis-end") {
                  return (
                    <span key={`${item}-${idx}`} className="px-2 text-gray-400">…</span>
                  );
                }
                const page = item;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] h-[36px] px-2 rounded-lg text-sm font-medium transition ${
                      page === currentPage
                        ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
          </>
        )}
      </main>
    </div>
  );
}
