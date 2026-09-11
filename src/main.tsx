import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EarCaptureApp } from "./components/EarCaptureApp";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EarCaptureApp />
  </StrictMode>,
);
