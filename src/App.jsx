import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UploadImage from "./pages/UploadImage";
import LoadImage from "./pages/ShowImage";
import UuploadWithName from "./pages/UploadWithName";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadImage />} />
        <Route path="/:id" element={<LoadImage />} />
        <Route path="/home" element={<UploadImage />} />
        <Route path="/255141" element={<UuploadWithName />} />
      </Routes>
    </Router>
  );
}

export default App;
