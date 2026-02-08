import { useEffect, useRef, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { Link, useSearchParams } from "react-router-dom";
import Header from "../components/Header";

const PAGE_SIZE = 8;

/* ===============================
   SHUFFLE (Fisher–Yates)
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

  const pageRefs = useRef({});

  /* ===============================
     LOAD + SHUFFLE IDS (ONCE)
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

  /* ===============================
     LOAD CURRENT PAGE IMAGES
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
     AUTO-SCROLL ACTIVE PAGE (MOBILE)
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

      {/* STATUS */}
      {loading && (
        <p className="text-center mt-8 text-sm text-gray-500">
          Loading gallery…
        </p>
      )}

      {error && (
        <p className="text-center mt-8 text-sm text-red-500">{error}</p>
      )}

      {/* GALLERY */}
      {!loading && !error && (
        <div className="px-3 sm:px-4 mt-4 max-w-[1600px] mx-auto">
          <div
            className="
              columns-1
              sm:columns-2
              lg:columns-3
              xl:columns-4
              gap-3 sm:gap-4
            "
          >
            {images.map((img) => (
              <Link
                key={img.id}
                to={`/${img.id}`}
                target="_blank"
                className="block mb-3 sm:mb-4 break-inside-avoid"
              >
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="
                    w-full
                    block
                    object-contain
                    bg-gray-100
                  "
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div
          className="
            fixed bottom-0 left-0 right-0
            z-30
            bg-white/80
            backdrop-blur-xl
            border-t border-white/40
          "
        >
          {/* MOBILE: SCROLLABLE */}
          <div
            className="
              flex gap-2
              px-3 py-3
              overflow-x-auto
              md:overflow-visible
              md:justify-center
            "
          >
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              const active = page === currentPage;

              return (
                <button
                  key={page}
                  ref={(el) => (pageRefs.current[page] = el)}
                  onClick={() => setSearchParams({ page })}
                  className={`
                    min-w-[44px] h-[44px]
                    px-4
                    rounded-lg
                    text-sm font-medium
                    shrink-0
                    ${
                      active
                        ? "bg-red-600 text-white"
                        : "bg-white/70 text-gray-700 hover:bg-white"
                    }
                  `}
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
