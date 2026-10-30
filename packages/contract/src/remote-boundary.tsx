import { Component, type ComponentType, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";

type Load = () => Promise<{ default: ComponentType }>;

// One lazy component per remote id so re-renders don't refetch
const lazyRemotes = new Map<string, ReturnType<typeof lazy>>();
const getRemote = (id: string, load: Load) => {
  let remote = lazyRemotes.get(id);
  if (!remote) {
    remote = lazy(load);
    lazyRemotes.set(id, remote);
  }
  return remote;
};

class Boundary extends Component<{ id: string; load: Load; at: string }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // A failed lazy() stays rejected: drop it so a later remount (e.g. back from the catalog) loads again
  componentDidCatch() {
    lazyRemotes.delete(this.props.id);
  }

  // Leaving/changing the page after a failure retries (also drops the cached rejected lazy)
  componentDidUpdate(prev: { at: string }) {
    if (this.state.failed && prev.at !== this.props.at) this.retry();
  }

  retry = () => {
    // A failed lazy() stays rejected, so drop it and remount (key) to force a fresh load
    lazyRemotes.delete(this.props.id);
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <div role="alert">
          <p>Module "{this.props.id}" is currently unavailable.</p>
          <button type="button" onClick={this.retry}>
            Retry
          </button>
        </div>
      );
    }
    const Remote = getRemote(this.props.id, this.props.load);
    return (
      <Suspense key={this.state.attempt} fallback={<p>Loading {this.props.id}...</p>}>
        <Remote />
      </Suspense>
    );
  }
}

export const RemoteBoundary = (props: { id: string; load: Load }) => <Boundary {...props} at={useLocation().key} />;
