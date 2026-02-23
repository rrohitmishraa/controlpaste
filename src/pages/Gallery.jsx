import { useEffect, useRef, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
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

  const pageRefs = useRef({});

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
        setAllIds(shuffleArray(imagesRes.items.map((i) => i.name)));
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

  /* ===============================
     LOAD PAGE IMAGES
  ================================ */
  useEffect(() => {
    const loadPageImages = async () => {
      if (!allIds.length) return;

      const start = (currentPage - 1) * PAGE_SIZE;
      const pageIds = allIds.slice(start, start + PAGE_SIZE);

      const data = await Promise.all(
        pageIds.map(async (id) => ({
          id,
          url: await getDownloadURL(ref(storage, `images/${id}`)),
        })),
      );

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

  /* ===============================
     AUTO SCROLL PAGE BUTTON
  ================================ */
  useEffect(() => {
    const btn = pageRefs.current[currentPage];
    if (btn) {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [currentPage]);

  const totalPages = Math.ceil(allIds.length / PAGE_SIZE);

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
                  <p className="text-xs text-gray-600 break-all">{img.id}</p>

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
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t">
          <div className="flex gap-2 px-4 py-3 overflow-x-auto md:justify-center">
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              const active = page === currentPage;

              return (
                <button
                  key={page}
                  ref={(el) => (pageRefs.current[page] = el)}
                  onClick={() => setSearchParams({ page })}
                  className={`min-w-[44px] h-[44px] px-4 rounded-lg text-sm font-medium shrink-0 ${
                    active
                      ? "bg-red-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
