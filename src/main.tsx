import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorFallback } from "./components/ErrorFallback";

// Catch top-level errors (before React mounts)
window.onerror = function(msg, url, line, col, error) {
  const root = document.getElementById('root');
  if (root) {
    // Only override if we haven't mounted correctly (check for specific class or just assume if this fires it's bad)
    // Actually, let's append an error banner
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: #1a1a1a; color: white; z-index: 10000;
      padding: 20px; font-family: system-ui; display: flex; flex-direction: column; justify-content: center; align-items: center;
    `;
    el.innerHTML = `
      <h1 style="color: #ff5555">Startup Error</h1>
      <pre style="background: #333; padding: 15px; border-radius: 5px; max-width: 90%; overflow: auto;">
${msg}
File: ${url}
Line: ${line}:${col}
Error: ${error ? error.stack : 'N/A'}
      </pre>
      <button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px;">Reload</button>
    `;
    document.body.appendChild(el);
  }
  return false;
};

// Catch unhandled promise rejections
window.onunhandledrejection = function(event) {
  console.error('Unhandled rejection:', event.reason);
  // We don't always want to show a full blocking error for these, but log firmly
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorFallback>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorFallback>
  </React.StrictMode>,
);

// Remove static loader once React mounts successfully
// (React will replace the #root content, effectively removing the loader HTML inside it)

