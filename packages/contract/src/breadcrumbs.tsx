import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";

interface Crumb {
  order: number;
  label: string;
}

const BreadcrumbsContext = createContext<{
  crumbs: Crumb[];
  setCrumbs: Dispatch<SetStateAction<Crumb[]>>;
} | null>(null);

export const BreadcrumbsProvider = ({ children }: { children: ReactNode }) => {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return <BreadcrumbsContext value={{ crumbs, setCrumbs }}>{children}</BreadcrumbsContext>;
};

export const useBreadcrumbs = () => {
  const ctx = useContext(BreadcrumbsContext);
  if (!ctx) throw new Error("useBreadcrumbs outside BreadcrumbsProvider");
  return ctx.crumbs.map((c) => c.label);
};

// Render runs parent-first but effects run child-first, so order is taken at first render
let nextOrder = 0;

export const useBreadcrumb = (label: string) => {
  const ctx = useContext(BreadcrumbsContext);
  if (!ctx) throw new Error("useBreadcrumb outside BreadcrumbsProvider");
  const { setCrumbs } = ctx;
  const [order] = useState(() => nextOrder++);
  useEffect(() => {
    setCrumbs((c) => [...c, { order, label }].sort((a, b) => a.order - b.order));
    return () => setCrumbs((c) => c.filter((x) => x.order !== order));
  }, [order, label, setCrumbs]);
};
