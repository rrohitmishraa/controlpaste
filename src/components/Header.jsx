import { Link } from "react-router-dom";

export default function Header({ page }) {
  return (
    <header
      className="
        sticky top-0 z-40
        h-[56px] md:h-[72px]
        w-full
        flex items-center
        px-3 md:px-6
        bg-white/80
        backdrop-blur-xl
        border-b border-white/40
        shadow-[0_1px_0_rgba(0,0,0,0.04)]
      "
    >
      {/* BRAND BADGE */}
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
        "
      >
        <span>PASTE</span>
        <span className="text-xs opacity-70">v5.0</span>
      </Link>

      {/* CTA */}
      {page !== "home" && (
        <Link
          to="/"
          className="
            ml-auto
            px-4 py-2
            rounded-lg
            text-sm md:text-base
            bg-red-600
            text-white
            hover:bg-red-700
          "
        >
          Share an Image
        </Link>
      )}
    </header>
  );
}
