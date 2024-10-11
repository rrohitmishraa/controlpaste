import { Link } from "react-router-dom";

export default function Header() {
  return (
    <Link
      to="/"
      className="w-[180px] md:w-[280px] flex flex-col justify-center items-center"
    >
      <h1 className="text-center text-[56px] md:text-[60px] mb-[-20px] md:mb-[-18px] font-bold w-full">
        PASTE
      </h1>
      <span className="bg-black text-white text-[12px] md:text-[12px] text-center w-[170px] md:w-[180px]">
        SHARE IMAGES EASILY
        <span className="text-[8px] ml-[4px] md:text-[12px]">v2.4</span>
      </span>
    </Link>
  );
}
