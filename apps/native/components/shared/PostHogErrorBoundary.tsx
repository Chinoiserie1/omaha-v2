import { Component, type ReactNode } from "react";
import { usePostHog } from "posthog-react-native";
import { ErrorScreen } from "./ErrorScreen";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class PostHogErrorBoundaryInner extends Component<Props & { posthog: ReturnType<typeof usePostHog> }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.posthog.capture("$exception", {
      $exception_type: error.name,
      $exception_message: error.message,
      $exception_stack_trace_raw: error.stack ?? "",
      $exception_component_stack: errorInfo.componentStack ?? "",
      $exception_source: "react_error_boundary",
    });
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

export function PostHogErrorBoundary({ children }: Props) {
  const posthog = usePostHog();
  return <PostHogErrorBoundaryInner posthog={posthog}>{children}</PostHogErrorBoundaryInner>;
}
