import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UploadImage from "./pages/UploadImage";
import LoadImage from "./pages/ShowImage";
import UploadWithName from "./pages/UploadWithName";
import Gallery from "./pages/Gallery";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadImage />} />
        <Route path="/:id" element={<LoadImage />} />
        <Route path="/home" element={<UploadImage />} />
        <Route path="/255141" element={<UploadWithName />} />
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </Router>
  );
}

export default App;
