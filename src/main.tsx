import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;

try {
  createRoot(root).render(<App />);
} catch (err) {
  console.error("Failed to mount app:", err);
  root.innerHTML = `<div style="color:white;padding:2rem;font-family:sans-serif">
    <h1>Errore di avvio</h1>
    <p>${err instanceof Error ? err.message : String(err)}</p>
  </div>`;
}
