import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useKonamiCode } from "./hooks/useKonamiCode";
import "./index.css";
import CanvasPage from "./pages/CanvasPage";
import Display from "./pages/Display";
import AlarmsPage from "./pages/config/AlarmsPage";
import ConfigPage from "./pages/config/ConfigPage";
import SetupPage from "./pages/config/SetupPage";
import ThemeEditorPage from "./pages/config/ThemeEditorPage";

export default function App() {
  useKonamiCode();
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/display/config" replace />} />
        <Route path="/setup" element={<Navigate to="/display/setup" replace />} />
        <Route path="/display" element={<Display />}>
          <Route path="now" />
          <Route path="canvas" element={<CanvasPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="theme" element={<ThemeEditorPage />} />
          <Route path="tema" element={<Navigate to="/display/theme" replace />} />
          <Route path="alarms" element={<AlarmsPage />} />
          <Route path="alarmes" element={<Navigate to="/display/alarms" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
