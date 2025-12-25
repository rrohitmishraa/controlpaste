import { Link } from "react-router-dom";

export default function Header(props) {
  console.log(props.page);
  return (
    <div className="flex bg-blue-600 px-[8px] md:px-[18px] text-white w-screen h-[60px] md:h-[80px] flex-row justify-center items-center">
      <Link to="/" className="flex justify-start items-center">
        <h1 className="text-center text-[18px] md:text-[40px] font-bold">
          PASTE.UNLINKLY
          <span className="text-[8px] ml-[4px] md:text-[12px]">v3.0</span>
        </h1>
      </Link>

      <img
        src="./images/line.png"
        alt=""
        className={`invert h-[70%] ${
          props.page === "home" ? "hidden" : "block"
        }`}
      />

      <Link
        to="/"
        className={`text-[14px] md:text-[18px] h-[40px] flex items-center bg-red-400 text-white px-[15px] md:ml-[10px] rounded-[4px] ${
          props.page === "home" ? "hidden" : "block"
        }`}
      >
        Share You Own Image
      </Link>
    </div>
  );
}
