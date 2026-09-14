import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EarCaptureApp } from "./components/EarCaptureApp";
import { LocaleProvider } from "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <EarCaptureApp />
    </LocaleProvider>
  </StrictMode>,
);
