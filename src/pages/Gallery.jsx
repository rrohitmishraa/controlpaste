import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage, database } from "../firebase";
import { ref as dbRef, get } from "firebase/database";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";

const PAGE_SIZE = 12;

/* ============================================================
   SHUFFLE ARRAY
   ============================================================ */

const shuffleArray = (array) => {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
};

/* ============================================================
   GALLERY COMPONENT
   ============================================================ */

export default function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPage = Math.max(1, Number(searchParams.get("page")) || 1);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allIds, setAllIds] = useState([]);
  const [images, setImages] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  /*
   * The currently selected image for the floating popup.
   * Null means the popup is closed.
   */
  const [selectedImage, setSelectedImage] = useState(null);

  /* ============================================================
     SYNC CURRENT PAGE WITH URL
     ============================================================ */

  useEffect(() => {
    setSearchParams({ page: String(currentPage) }, { replace: true });
  }, [currentPage, setSearchParams]);

  /* ============================================================
     LOAD ALL IMAGE IDS
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const fetchImageIds = async () => {
      setInitialLoading(true);
      setError("");

      try {
        const rootRes = await listAll(ref(storage));

        const imagesFolder = rootRes.prefixes.find(
          (folder) => folder.name === "images",
        );

        if (!imagesFolder) {
          if (!cancelled) {
            setAllIds([]);
          }

          return;
        }

        const imagesRes = await listAll(imagesFolder);

        let ids = imagesRes.items.map((item) => item.name);

        try {
          const snap = await get(dbRef(database, "gallerySettings"));

          const settings = snap.exists() ? snap.val() : {};

          /* Remove hidden images */

          ids = ids.filter((id) => settings[id]?.visible !== false);

          /* Pinned images always appear first */

          const pinnedIds = ids.filter((id) => settings[id]?.pinned === true);

          const unpinnedIds = ids.filter((id) => settings[id]?.pinned !== true);

          /* Shuffle only unpinned images */

          ids = [...pinnedIds, ...shuffleArray(unpinnedIds)];
        } catch (settingsError) {
          console.error("Failed to load gallery settings:", settingsError);

          /*
           * The gallery should still work even if settings
           * cannot be loaded.
           */

          ids = shuffleArray(ids);
        }

        if (!cancelled) {
          setAllIds(ids);

          /*
           * Make sure the requested page actually exists.
           */

          const totalPages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));

          setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
        }
      } catch (err) {
        console.error("Failed to load gallery:", err);

        if (!cancelled) {
          setError("Failed to load gallery");
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    fetchImageIds();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     LOG GALLERY PAGE VISIT

     This only logs the gallery visit.

     Opening an image in the floating popup does NOT log an
     image view because the user has not opened the actual
     image page.

     The actual image page is still responsible for its own
     view logging.
     ============================================================ */

  useEffect(() => {
    fetch(
      "https://us-central1-controlpaste-app.cloudfunctions.net/logVisit?page=gallery",
    ).catch((err) => {
      console.error("Failed to log gallery visit:", err);
    });
  }, []);

  /* ============================================================
     CLOSE POPUP WITH ESCAPE KEY
     ============================================================ */

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    };

    if (selectedImage) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage]);

  /* ============================================================
     LOAD CURRENT PAGE IMAGE URLS
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadCurrentPage = async () => {
      if (initialLoading) {
        return;
      }

      /*
       * No images available.
       */

      if (allIds.length === 0) {
        setImages([]);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(allIds.length / PAGE_SIZE));

      const safePage = Math.min(Math.max(1, currentPage), totalPages);

      /*
       * Correct invalid page numbers.
       */

      if (safePage !== currentPage) {
        setCurrentPage(safePage);
        return;
      }

      setPageLoading(true);
      setError("");

      try {
        const start = (safePage - 1) * PAGE_SIZE;

        const pageIds = allIds.slice(start, start + PAGE_SIZE);

        /*
         * Fetch all image URLs for the current page
         * in parallel.
         */

        const results = await Promise.all(
          pageIds.map(async (id) => {
            try {
              const url = await getDownloadURL(ref(storage, `images/${id}`));

              return {
                id,
                url,
                displayName: id,
              };
            } catch (err) {
              console.error(`Failed to load image ${id}:`, err);

              return null;
            }
          }),
        );

        if (!cancelled) {
          setImages(results.filter((image) => image !== null));
        }
      } catch (err) {
        console.error("Failed to load page images:", err);

        if (!cancelled) {
          setError("Failed to load images on this page");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    loadCurrentPage();

    return () => {
      cancelled = true;
    };
  }, [allIds, currentPage, initialLoading]);

  /* ============================================================
     OPEN IMAGE IN NEW TAB

     This opens the actual image page, so LoadImage.jsx can
     handle view logging as usual.
     ============================================================ */

  const openImageInNewTab = (id) => {
    window.open(`/${encodeURIComponent(id)}`, "_blank", "noopener,noreferrer");
  };

  /* ============================================================
     COPY IMAGE LINK
     ============================================================ */

  const copyLink = async (id) => {
    const link = `https://paste.unlinkly.com/${encodeURIComponent(id)}`;

    try {
      await navigator.clipboard.writeText(link);

      setCopiedId(id);

      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  /* ============================================================
     PAGINATION
     ============================================================ */

  const totalPages = Math.max(1, Math.ceil(allIds.length / PAGE_SIZE));

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items = [1];

    if (currentPage > 3) {
      items.push("ellipsis-start");
    }

    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      items.push(i);
    }

    if (currentPage < totalPages - 2) {
      items.push("ellipsis-end");
    }

    items.push(totalPages);

    return items;
  };

  const paginationItems = getPaginationItems();

  const loading = initialLoading || pageLoading;

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="min-h-screen bg-gray-50 pb-[96px]">
      <Header page="gallery" />

      {/* LOADING SKELETON */}

      {loading && (
        <div className="px-4 mt-6 max-w-[1600px] mx-auto columns-1 sm:columns-3 lg:columns-3 xl:columns-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="mb-4 break-inside-avoid bg-white rounded-lg border shadow-sm overflow-hidden animate-pulse"
            >
              <div className="w-full h-48 bg-gray-200" />

              <div className="p-3 space-y-2">
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ERROR */}

      {error && (
        <p className="text-center mt-8 text-sm text-red-500">{error}</p>
      )}

      {/* EMPTY PAGE ERROR */}

      {!loading && !error && images.length === 0 && allIds.length > 0 && (
        <p className="text-center mt-20 text-sm text-red-500">
          Failed to load images on this page. Try refreshing.
        </p>
      )}

      {/* GALLERY */}

      {!loading && !error && (
        <div className="px-4 mt-6 max-w-[1600px] mx-auto">
          <p className="text-xs text-gray-400 mb-2">{allIds.length} images</p>

          <div className="columns-1 sm:columns-3 lg:columns-3 xl:columns-4 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="mb-4 break-inside-avoid bg-white rounded-lg border shadow-sm overflow-hidden"
              >
                {/* IMAGE CLICK → FLOATING POPUP */}

                <button
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className="block w-full cursor-pointer"
                  title="Preview image"
                >
                  <img
                    src={img.url}
                    alt={img.displayName}
                    loading="lazy"
                    className="w-full object-contain bg-gray-100 max-w-sm h-32 rounded transition-opacity hover:opacity-90"
                  />
                </button>

                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {img.displayName}
                  </p>

                  <p className="text-[10px] text-gray-400 break-all font-mono">
                    {img.id}
                  </p>

                  {/* ACTION BUTTONS */}

                  <div className="flex gap-2">
                    {/* COPY LINK */}

                    <button
                      onClick={() => copyLink(img.id)}
                      className={`flex-1 py-1.5 text-xs rounded-md transition ${
                        copiedId === img.id ?
                          "bg-green-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      {copiedId === img.id ? "Copied ✓" : "Copy Link"}
                    </button>

                    {/* OPEN IN NEW TAB */}

                    <button
                      type="button"
                      onClick={() => openImageInNewTab(img.id)}
                      className="flex-1 py-1.5 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-white transition"
                      title="Open image page in new tab"
                    >
                      Open ↗
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          FLOATING IMAGE POPUP
          ======================================================== */}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${selectedImage.displayName}`}
        >
          {/* BACKDROP */}

          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute inset-0 w-full h-full bg-black/70 backdrop-blur-sm cursor-default"
            aria-label="Close image preview"
          />

          {/* POPUP CONTENT */}

          <div className="relative z-10 w-full max-w-6xl max-h-full bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* HEADER */}

            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-white">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {selectedImage.displayName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="shrink-0 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-lg transition"
                aria-label="Close popup"
                title="Close"
              >
                ×
              </button>
            </div>

            {/* IMAGE */}

            <div className="bg-gray-100 flex items-center justify-center max-h-[80vh] overflow-auto p-3 sm:p-6">
              <img
                src={selectedImage.url}
                alt={selectedImage.displayName}
                className="max-w-full max-h-[72vh] object-contain"
              />
            </div>

            {/* FOOTER ACTIONS */}

            <div className="flex items-center justify-between gap-3 p-3 border-t bg-white">
              <button
                type="button"
                onClick={() => copyLink(selectedImage.id)}
                className={`px-4 py-2 text-xs rounded-md transition ${
                  copiedId === selectedImage.id ?
                    "bg-green-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {copiedId === selectedImage.id ? "Copied ✓" : "Copy Link"}
              </button>

              <button
                type="button"
                onClick={() => openImageInNewTab(selectedImage.id)}
                className="px-4 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-white transition"
              >
                Open in New Tab ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGINATION */}

      {totalPages > 1 && !initialLoading && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
            {/* PREVIOUS */}

            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1 || pageLoading}
              className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* PAGE NUMBERS */}

            <div className="flex items-center gap-1 overflow-x-auto">
              {paginationItems.map((item, index) => {
                if (item === "ellipsis-start" || item === "ellipsis-end") {
                  return (
                    <span
                      key={`${item}-${index}`}
                      className="px-2 text-gray-400 select-none text-sm"
                    >
                      …
                    </span>
                  );
                }

                const active = item === currentPage;

                return (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    disabled={pageLoading}
                    className={`min-w-[36px] h-[36px] px-2 rounded-lg text-sm font-medium transition shrink-0 disabled:opacity-50 ${
                      active ?
                        "bg-red-600 text-white shadow-md shadow-red-600/20"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* NEXT */}

            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages || pageLoading}
              className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
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
