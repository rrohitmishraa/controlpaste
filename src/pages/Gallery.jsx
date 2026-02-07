import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { Link, useSearchParams } from "react-router-dom";
import Header from "../components/Header";

const PAGE_SIZE = 10;

function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;

  const [allIds, setAllIds] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ───────────────────────────────
     1️⃣ LOAD ALL IMAGE IDS ONCE
     ─────────────────────────────── */
  useEffect(() => {
    const fetchIds = async () => {
      try {
        const rootRef = ref(storage);
        const rootRes = await listAll(rootRef);

        const imagesFolder = rootRes.prefixes.find((p) => p.name === "images");

        if (!imagesFolder) {
          setLoading(false);
          return;
        }

        const imagesRes = await listAll(imagesFolder);

        const sorted = imagesRes.items
          .map((item) => item.name)
          .sort((a, b) => Number(b) - Number(a));

        setAllIds(sorted);
      } catch (err) {
        console.error(err);
        setError("Failed to load gallery");
      } finally {
        setLoading(false);
      }
    };

    fetchIds();
  }, []);

  /* ───────────────────────────────
     2️⃣ LOAD IMAGES FOR CURRENT PAGE
     ─────────────────────────────── */
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

  const totalPages = Math.ceil(allIds.length / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header page="gallery" />

      {/* LOADING */}
      {loading && (
        <p className="text-center mt-12 text-gray-500">Loading gallery…</p>
      )}

      {/* ERROR */}
      {error && <p className="text-center mt-12 text-red-500">{error}</p>}

      {/* GALLERY */}
      {!loading && !error && (
        <div className="px-4 pb-12 max-w-[1600px] mx-auto">
          {/* 🔥 MASONRY */}
          <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-4">
            {images.map((img) => (
              <Link
                key={img.id}
                to={`/${img.id}`}
                target="blank_"
                className="
                  block mb-4 break-inside-avoid
                  bg-white rounded-xl
                  border border-gray-100
                  shadow-sm hover:shadow-md
                  transition-shadow
                "
              >
                {/* FILE NAME */}
                <div className="px-4 pt-4">
                  <p
                    className="
                                text-base
                                font-semibold
                                text-red-600
                                break-all
                                leading-tight
                            "
                  >
                    {img.id}
                  </p>

                  {/* separator */}
                  <div
                    className="
                                mt-3
                                h-[1.5px]
                                w-full
                                bg-gray-300/70
                            "
                  />
                </div>

                {/* IMAGE */}
                <img
                  src={img.url}
                  alt={img.id}
                  loading="lazy"
                  decoding="async"
                  className="
                    w-full block
                    object-contain
                    bg-gray-100
                    max-h-[80vh]
                  "
                />
              </Link>
            ))}
          </div>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12 flex-wrap gap-2">
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                const active = page === currentPage;

                return (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ page })}
                    className={`
                      px-4 py-2 rounded-md text-sm
                      ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Gallery;
