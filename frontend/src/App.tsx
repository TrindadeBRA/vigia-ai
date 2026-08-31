import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Display from "./pages/Display";
import Panel from "./pages/Panel";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="min-h-full bg-canvas text-ink antialiased"><Panel /></div>} />
        <Route path="/display" element={<Display />} />
        <Route path="/display/" element={<Navigate to="/display" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
