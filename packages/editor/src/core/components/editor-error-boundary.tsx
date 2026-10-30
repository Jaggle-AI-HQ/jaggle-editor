"use client";

import { Component, type JSX } from "react";

type Props = {
  children: JSX.Element;
  onError: (error: Error) => void;
};

type State = {
  error: Error | null;
};

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="px-3 py-2 text-sm text-destructive">
          The editor hit an error. Reload the page to keep writing.
        </p>
      );
    }

    return this.props.children;
  }
}
