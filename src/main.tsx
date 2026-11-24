import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { KEYS, storage } from "./lib/storage";

document.documentElement.setAttribute("data-theme", storage.get(KEYS.theme, "light"));
document.documentElement.classList.toggle("stealth-window", window.location.hash === "#/stealth");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
