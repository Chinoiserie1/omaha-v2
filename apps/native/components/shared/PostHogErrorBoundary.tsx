import { Component, type ReactNode } from "react";
import { captureError } from "../../lib/capture-error";
import { ErrorScreen } from "./ErrorScreen";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PostHogErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    captureError(error, { source: "react_error_boundary" });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
