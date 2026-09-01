import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Display from "./pages/Display";
import ConfigPage from "./pages/config/ConfigPage";
import SetupPage from "./pages/config/SetupPage";
import ThemeEditorPage from "./pages/config/ThemeEditorPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/display/config" replace />} />
        <Route path="/setup" element={<Navigate to="/display/setup" replace />} />
        <Route path="/display" element={<Display />}>
          <Route path="config" element={<ConfigPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="tema" element={<ThemeEditorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
