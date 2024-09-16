import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UploadImage from "./components/UploadImage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadImage />} />
        <Route path="/home" element={<UploadImage />} />
      </Routes>
    </Router>
  );
}

export default App;
