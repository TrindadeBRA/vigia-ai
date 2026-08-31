import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Display from "./pages/Display";
import ConfigPage from "./pages/config/ConfigPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/display/config" replace />} />
        <Route path="/display" element={<Display />}>
          <Route path="config" element={<ConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
