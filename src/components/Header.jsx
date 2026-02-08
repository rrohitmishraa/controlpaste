import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Header({ page }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;

    setSearching(true);

    // Force router to treat this as a fresh navigation
    navigate(`/${value}`, {
      replace: false,
      state: { ts: Date.now() }, // 👈 key trick
    });

    // Stop spinner shortly after navigation
    setTimeout(() => setSearching(false), 300);
  };

  return (
    <header
      className="
        sticky top-0 z-40
        h-[56px] md:h-[72px]
        w-full
        bg-white/80
        backdrop-blur-xl
        border-b border-white/40
        shadow-[0_1px_0_rgba(0,0,0,0.04)]
      "
    >
      <div
        className="
          h-full
          max-w-[1600px]
          mx-auto
          px-3 md:px-6
          grid
          grid-cols-[auto_1fr_auto]
          items-center
          gap-3
        "
      >
        {/* LEFT: BRAND */}
        <Link
          to="/"
          className="
            flex items-center gap-2
            px-3 py-1.5
            rounded-full
            bg-gray-900/90
            text-white
            text-sm md:text-base
            font-semibold
            whitespace-nowrap
          "
        >
          <span>PASTE</span>
          <span className="text-xs opacity-70">v5.1</span>
        </Link>

        {/* CENTER: SEARCH */}
        <form
          onSubmit={handleSearch}
          className="
            w-full
            max-w-[520px]
            mx-auto
            flex items-center gap-2
          "
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search image name…"
            disabled={searching}
            className="
              w-full
              px-4 py-2
              rounded-full
              text-sm
              bg-white/70
              border border-gray-300/60
              focus:outline-none
              focus:ring-2 focus:ring-blue-500/30
              disabled:opacity-60
            "
          />

          <button
            type="submit"
            disabled={searching}
            className="
              px-4 py-2
              rounded-full
              text-sm
              flex items-center gap-2
              bg-blue-600
              text-white
              hover:bg-blue-700
              disabled:opacity-60
              disabled:cursor-not-allowed
              shrink-0
            "
          >
            {searching ? (
              <>
                <span
                  className="
                    h-4 w-4
                    border-2 border-white/60
                    border-t-white
                    rounded-full
                    animate-spin
                  "
                />
                Searching…
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* RIGHT: SHARE CTA */}
        {page !== "home" ? (
          <Link
            to="/"
            className="
              px-4 py-2
              rounded-lg
              text-sm md:text-base
              bg-red-600
              text-white
              hover:bg-red-700
              whitespace-nowrap
            "
          >
            Share an Image
          </Link>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}
