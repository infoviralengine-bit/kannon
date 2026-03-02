import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;

try {
  createRoot(root).render(<App />);
} catch (err) {
  console.error("Failed to mount app:", err);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color:white;padding:2rem;font-family:sans-serif';
  const heading = document.createElement('h1');
  heading.textContent = 'Errore di avvio';
  const message = document.createElement('p');
  message.textContent = err instanceof Error ? err.message : String(err);
  errorDiv.appendChild(heading);
  errorDiv.appendChild(message);
  root.appendChild(errorDiv);
}
