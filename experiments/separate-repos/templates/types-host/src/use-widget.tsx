import { loadRemote } from "@module-federation/runtime";

export const load = async () => {
  const widget = await loadRemote<typeof import("typesRemote/Widget")>("typesRemote/Widget");
  const fmt = await import("typesRemote/format");
  return <>{widget && <widget.default title="Orders" count={3} />}{fmt.formatCount(3)}</>;
};
