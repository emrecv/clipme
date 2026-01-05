import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorFallback } from "./components/ErrorFallback";

// Signal to index.html that we are alive!
const signalAppLoaded = () => {
  if ((window as any).appLoaded) {
    (window as any).appLoaded();
  }
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

// Call immediately after render attempt
signalAppLoaded();

// Remove static loader once React mounts successfully
// (React will replace the #root content, effectively removing the loader HTML inside it)
