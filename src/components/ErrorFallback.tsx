import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorFallback extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "2rem",
          backgroundColor: "#1a1a1a",
          color: "#fff",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif"
        }}>
          <h1 style={{ color: "#ff5555" }}>Something went wrong</h1>
          <p>Please take a screenshot of this and send it to support.</p>
          
          <div style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#2a2a2a",
            borderRadius: "0.5rem",
            maxWidth: "800px",
            width: "100%",
            overflow: "auto",
            border: "1px solid #444"
          }}>
            <h3 style={{ color: "#ffaaaa", margin: "0 0 0.5rem 0" }}>
              {this.state.error?.toString()}
            </h3>
            <pre style={{ 
              fontSize: "0.85rem", 
              opacity: 0.8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word" 
            }}>
              {this.state.errorInfo?.componentStack || this.state.error?.stack}
            </pre>
          </div>

          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: "2rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#E5C009",
              color: "black",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "1rem"
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
