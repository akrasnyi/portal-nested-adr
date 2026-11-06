import { Component, type ComponentType, lazy, Suspense, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

import { errorChain, pickRecovery, type Recovery, RemoteLoadError } from "./recovery";

// What every remote's "./App" exposes: loaders type loadRemote<RemoteModule>(...), remotes type their default export as RemoteApp
export type RemoteApp = ComponentType;
export type RemoteModule = { default: RemoteApp };

// canRetryLoad: the loader re-registers the remote before it runs again, so a failed load can be retried in place (recovery.ts)
export type RemoteLoader = (() => Promise<RemoteModule>) & { canRetryLoad?: boolean };

// One lazy component per remote id so re-renders don't refetch
const lazyRemotes = new Map<string, ReturnType<typeof lazy>>();
const getRemote = (id: string, load: RemoteLoader) => {
  let remote = lazyRemotes.get(id);
  if (!remote) {
    remote = lazy(async () => {
      try {
        return await load();
      } catch (e) {
        throw new RemoteLoadError(id, e);
      }
    });
    lazyRemotes.set(id, remote);
  }
  return remote;
};

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

// Cause text is shown raw, fine for this spike; production should show a generic text and log the cause
const ErrorPanel = ({
  id,
  error,
  recovery,
  onRetry,
}: {
  id: string;
  error: unknown;
  recovery: Recovery;
  onRetry: () => void;
}) => {
  const online = useOnline();
  const messages = [...new Set(errorChain(error).map((e) => (e instanceof Error ? e.message : String(e))))];
  return (
    <div role="alert">
      <p>Module "{id}" is currently unavailable.</p>
      <ul>
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {recovery === "retry" ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : (
        <>
          <button type="button" onClick={() => window.location.reload()} disabled={!online}>
            Reload page
          </button>
          {!online && <p>No connection. You can retry when you are back online.</p>}
        </>
      )}
    </div>
  );
};

type BoundaryState = {
  failed: boolean;
  error: unknown;
  recovery: Recovery;
  attempt: number;
  remountedAt: number | null;
};

class Boundary extends Component<{ id: string; load: RemoteLoader; at: string }, BoundaryState> {
  state: BoundaryState = { failed: false, error: null, recovery: "retry", attempt: 0, remountedAt: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  // A failed lazy() stays rejected: drop it so a later remount (e.g. back from the catalog) loads again
  componentDidCatch(error: unknown) {
    lazyRemotes.delete(this.props.id);
    const recovery = pickRecovery({
      error,
      canRetryLoad: this.props.load.canRetryLoad === true,
      remountedAt: this.state.remountedAt,
    });
    this.setState({ recovery });
  }

  // Leaving/changing the page after a failure retries (also drops the cached rejected lazy)
  componentDidUpdate(prev: { at: string }) {
    if (this.state.failed && prev.at !== this.props.at) this.retry();
  }

  retry = () => {
    // A failed lazy() stays rejected, so drop it and remount (key) to force a fresh load
    lazyRemotes.delete(this.props.id);
    this.setState((s) => ({ failed: false, error: null, attempt: s.attempt + 1, remountedAt: Date.now() }));
  };

  render() {
    if (this.state.failed) {
      return (
        <ErrorPanel id={this.props.id} error={this.state.error} recovery={this.state.recovery} onRetry={this.retry} />
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

export const RemoteBoundary = (props: { id: string; load: RemoteLoader }) => (
  <Boundary {...props} at={useLocation().key} />
);
