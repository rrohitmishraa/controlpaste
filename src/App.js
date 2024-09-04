import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UploadImage from "./components/UploadImage";
import ImageDisplay from "./components/ImageDisplay";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadImage />} />
        <Route path="/image/:imageId" element={<ImageDisplay />} />
      </Routes>
    </Router>
  );
}

export default App;
