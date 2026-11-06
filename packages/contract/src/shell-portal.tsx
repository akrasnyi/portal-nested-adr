import { type ReactNode, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const warned = new Set<string>();

// FR-11b: renders children into a shell DOM node (e.g. #shell-breadcrumbs). The node is looked up in a layout
// effect, after the shell has committed its layout, so a remote mounted inside that layout finds it.
// Unmounting the remote removes its children from the node.
export const ShellPortal = ({ target, children }: { target: string; children: ReactNode }) => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const found = document.getElementById(target);
    if (!found && !warned.has(target)) {
      warned.add(target);
      console.warn(`[portal] no shell node #${target}; ShellPortal renders nothing`);
    }
    setNode(found);
  }, [target]);
  return node ? createPortal(children, node) : null;
};
