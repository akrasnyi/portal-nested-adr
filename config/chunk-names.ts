// Renames vendor chunks in dist/assets only. Which modules share a chunk is still decided by Rollup and the
// federation plugin; manualChunks is not used because it pulls the federation runtime into vendor chunks.
type ChunkInfo = { moduleIds: readonly string[] };

const VENDOR_GROUPS: Record<string, RegExp> = {
  "vendor-react": /\/node_modules\/(react|react-dom|scheduler)\//,
  "vendor-react-router": /\/node_modules\/(react-router|react-router-dom|@remix-run)\//,
  "vendor-tanstack-query": /\/node_modules\/@tanstack\//,
};

// Plugin chunks (loadShare, runtimeInit, hostInit, virtualExposes, remoteEntry) contain the plugin's virtual
// modules (node_modules/__mf__virtual/..., \0-prefixed), which never match a vendor path, so they keep their names.
export const chunkFileName = (chunk: ChunkInfo) => {
  for (const [name, pattern] of Object.entries(VENDOR_GROUPS)) {
    if (chunk.moduleIds.length > 0 && chunk.moduleIds.every((id) => pattern.test(id))) {
      return `assets/${name}-[hash].js`;
    }
  }
  return "assets/[name]-[hash].js";
};
