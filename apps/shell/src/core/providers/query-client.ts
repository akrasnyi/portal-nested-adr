import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } });

// Pre-populated so a remote reading ["tenant"] proves it shares this cache (no fetch happens)
queryClient.setQueryData(["tenant"], { id: "tenant-42", name: "Acme Corp" });
