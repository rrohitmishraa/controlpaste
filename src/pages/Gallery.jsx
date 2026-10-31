import { useEffect, useState, useRef } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage, database } from "../firebase";
import { ref as dbRef, get } from "firebase/database";
import { Link, useSearchParams } from "react-router-dom";
import Header from "../components/Header";

const PAGE_SIZE = 8;

/* ===============================
   SHUFFLE
================================ */
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;

  const [allIds, setAllIds] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  /* ===============================
     LOAD IDS
  ================================ */
  useEffect(() => {
    const fetchIds = async () => {
      try {
        const rootRes = await listAll(ref(storage));
        const imagesFolder = rootRes.prefixes.find((p) => p.name === "images");

        if (!imagesFolder) {
          setLoading(false);
          return;
        }

        const imagesRes = await listAll(imagesFolder);
        let ids = imagesRes.items.map((i) => i.name);

        // Load visibility and pin settings
        try {
          const snap = await get(dbRef(database, "gallerySettings"));
          const settings = snap.exists() ? snap.val() : {};
          ids = ids.filter((id) => settings[id]?.visible !== false);
          const pinnedIds = ids.filter((id) => settings[id]?.pinned === true);
          const unpinnedIds = ids.filter((id) => settings[id]?.pinned !== true);
          const sortedIds = [...pinnedIds, ...shuffleArray(unpinnedIds)];
          ids = sortedIds;
        } catch {
          // If DB fails, show all
        }

        setAllIds(ids);
      } catch (err) {
        console.error(err);
        setError("Failed to load gallery");
      } finally {
        setLoading(false);
      }
    };

    fetchIds();
  }, []);

  useEffect(() => {
    fetch(
      "https://us-central1-controlpaste-app.cloudfunctions.net/logVisit?page=gallery",
    );
  }, []);

  const cachedSettingsRef = useRef({});

  /* ===============================
     LOAD PAGE IMAGES
  ================================ */
  useEffect(() => {
    const loadPageImages = async () => {
      if (!allIds.length) return;

      const start = (currentPage - 1) * PAGE_SIZE;
      const pageIds = allIds.slice(start, start + PAGE_SIZE);

      // Load display names from DB (cached via ref)
      let settings = cachedSettingsRef.current;
      if (Object.keys(settings).length === 0) {
        try {
          const snap = await get(dbRef(database, "gallerySettings"));
          settings = snap.exists() ? snap.val() : {};
          cachedSettingsRef.current = settings;
        } catch {
          // ignore
        }
      }

      // Load URLs sequentially to avoid overwhelming Firebase
      const data = [];
      for (const id of pageIds) {
        const url = await getDownloadURL(ref(storage, `images/${id}`));
        data.push({
          id,
          displayName: settings[id]?.displayName || id,
          url,
        });
      }

      setImages(data);
    };

    loadPageImages();
  }, [allIds, currentPage]);

  /* ===============================
     COPY LINK
  ================================ */
  const copyLink = async (id) => {
    const link = `https://paste.unlinkly.com/${id}`;
    await navigator.clipboard.writeText(link);

    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* Auto scroll removed with new pagination */

  const totalPages = Math.ceil(allIds.length / PAGE_SIZE);

  /* Ellipsis pagination logic */
  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items = [];
    items.push(1);
    if (currentPage > 3) items.push("ellipsis-start");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i !== 1 && i !== totalPages) items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("ellipsis-end");
    if (totalPages !== 1) items.push(totalPages);
    const seen = new Set();
    return items.filter((x) => {
      if (seen.has(x)) return false;
      seen.add(x);
      return true;
    });
  };

  const paginationItems = getPaginationItems();

  return (
    <div className="min-h-screen bg-gray-50 pb-[96px]">
      <Header page="gallery" />

      {loading && (
        <p className="text-center mt-8 text-sm text-gray-500">
          Loading gallery…
        </p>
      )}

      {error && (
        <p className="text-center mt-8 text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && (
        <div className="px-4 mt-6 max-w-[1600px] mx-auto">
          <p className="text-xs text-gray-400 mb-2">{allIds.length} images</p>
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="mb-4 break-inside-avoid bg-white rounded-lg border shadow-sm overflow-hidden"
              >
                {/* OPEN IN NEW TAB */}
                <Link to={`/${img.id}`} target="_blank" className="block">
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="w-full object-contain bg-gray-100"
                  />
                </Link>

                {/* INFO SECTION */}
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{img.displayName}</p>
                  <p className="text-[10px] text-gray-400 break-all font-mono">{img.id}</p>

                  <button
                    onClick={() => copyLink(img.id)}
                    className={`w-full py-1.5 text-xs rounded-md transition ${
                      copiedId === img.id
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    {copiedId === img.id ? "Copied ✓" : "Copy Link"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
            {/* Prev */}
            <button
              onClick={() => setSearchParams({ page: Math.max(1, currentPage - 1) })}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
              aria-label="Previous page"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {paginationItems.map((item, idx) => {
                if (item === "ellipsis-start" || item === "ellipsis-end") {
                  return (
                    <span key={`${item}-${idx}`} className="px-2 text-gray-400 select-none text-sm">
                      …
                    </span>
                  );
                }
                const page = item;
                const active = page === currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ page })}
                    className={`min-w-[36px] h-[36px] px-2 rounded-lg text-sm font-medium transition shrink-0 ${
                      active
                        ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                    aria-label={`Page ${page}`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            {/* Next */}
            <button
              onClick={() => setSearchParams({ page: Math.min(totalPages, currentPage + 1) })}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
