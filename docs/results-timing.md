# Results: how App Host gets Use case A's entry (cold-load timing)

Question: five ways App Host can get Use case A's `remoteEntry.js`. Which one shows Use case A soonest on a **direct visit** to `/V1/app-host/use-case-a` with a cold cache, and what does the request waterfall look like? Also: how many Use case A requests does the catalog page `/V1/app-host` make?

**Verdict: the default (a) is the fastest in this measurement.** The variants that read the entry from a JSON file (b, c) are slower by about one (c) or two (b) simulated round trips. The static variants (d, e) are about 200 ms slower on the direct visit, and d makes 4 Use case A requests on the catalog. At 0 ms latency all five are within 5 ms of each other, which is inside the noise. Localhost only, n=7, headless: treat these as ordering and rough cost, not as production numbers.

## Variants

Switch: `APP_HOST_VARIANT=a|b|c|d|e` when building `apps/app-host` (README "Experiment switches"). Default `a`. Production build only.

| Variant | What App Host does |
|---|---|
| **a** | Current default. The entry URL is in code (`USE_CASES`), `loadUseCase` registers it on the route. |
| **b** | The entry comes from `mf/app-host/use-cases.json`. The route loader (a separate chunk, `load-use-case-json`) fetches the JSON, looks up the entry by `id`, then calls the same `loadUseCase`. Catalog, sidebar and routes still use the in-code list. |
| **c** | As b, but `App.tsx` starts the JSON fetch when its module evaluates. The route loader awaits that promise. |
| **d** | Static remotes: the same config as `APP_HOST_STATIC_REMOTES=1` (reused, not duplicated). `import("useCaseA/App")`. |
| **e** | d plus `shareStrategy: "loaded-first"` in `federation()`. |

The JSON for b/c is written into `dist/use-cases.json` by a `closeBundle` hook in `apps/app-host/vite.config.ts`, only for `vite build` with b or c. Nothing JSON-shaped is committed. It holds the same fields as the `USE_CASES` entry (`id`, `remoteId`, `path`, `title`, `subtitle`, `entry`).

Code touched: `apps/app-host/vite.config.ts` (switch, `define` of `VITE_VARIANT`, the JSON hook, `shareStrategy` for e), `apps/app-host/src/App.tsx` (variant selection, the early fetch for c), new `apps/app-host/src/load-use-case-json.ts`. Default build: the new chunk and the early fetch are compiled out; the original verify passes 7/7 on it.

## Setup

- Production build (`vite build` per variant for app-host; shell and Use case A built once with the root `npm run build`). Single origin, `node scripts/serve.mjs` on :4174. Latency is simulated with CDP `Network.emulateNetworkConditions` (latency 100 ms or 0 ms, no throughput limit).
- Per run: a new browser context, `Network.setCacheDisabled`, and `user=admin` so access is allowed. Navigation to `/V1/app-host/use-case-a`.
- Timing: `performance.now()` in the page when `[data-check=react]` (the ProofPanel's first row) is rendered, polled per animation frame. Navigation start is `0` on that clock. The entry, App chunk and JSON start times come from the same page's Resource Timing entries, so there is one clock.
- Runs: 7 cold runs per variant at 100 ms, 7 at 0 ms, one catalog visit per variant at 0 ms. Headless Chromium (Playwright `chrome-headless-shell`), Node script outside the repo.
- All 70 cold runs passed 7/7 ProofPanel checks, with no console or page errors.

## Results

Direct visit, time until the ProofPanel is visible (ms). Median, with min-max in brackets. Start times are medians (ms after navigation start).

| Variant | visible, 100 ms latency | visible, 0 ms latency | Use case A `remoteEntry` start, 100 ms | Use case A `App` chunk start, 100 ms | `use-cases.json` start, 100 ms |
|---|---|---|---|---|---|
| a | **1772** (1735-1787) | 349 (342-352) | 1328 (1300-1340) | 1550 (1516-1561) | n/a |
| b | 1988 (1962-2009) | 348 (343-350) | 1538 (1519-1563) | 1762 (1740-1786) | 1431 (1406-1455) |
| c | 1872 (1847-1894) | 347 (345-352) | 1426 (1417-1463) | 1640 (1627-1676) | 1319 (1307-1351) |
| d | 1973 (1950-1987) | 345 (343-348) | 1212 (1193-1221) | 1754 (1727-1762) | n/a |
| e | 1971 (1954-1990) | 347 (344-350) | 1525 (1516-1558) | 1746 (1734-1773) | n/a |

Catalog page `/V1/app-host` (one visit each, 0 ms):

| Variant | Requests whose URL contains `use-case-a` | Requests for `use-cases.json` | All requests |
|---|---|---|---|
| a | 0 | 0 | 31 |
| b | 0 | 0 | 32 |
| c | 0 | **1** | 34 |
| d | **4** (`remoteEntry.js`, `runtimeInit`, `virtualExposes`, `preload-helper`) | 0 | 36 |
| e | 0 | 0 | 32 |

## Waterfall per variant (100 ms, run 1; the other runs have the same order)

- **a:** shell bootstrap, `config.json` (882) → App Host `remoteEntry.js` (1000) → App Host `App` chunk (1218) → Use case A `remoteEntry.js` (1327) → its init chunks (1431) → Use case A `App` and shared chunks (1538) → visible 1762. Each step waits for the previous one. The entry is requested only after App Host's code has run `loadRemote`.
- **b:** App Host `App` (1212) → `load-use-case-json` chunk (1323) → `use-cases.json` (1428) → entry (1533) → init (1638) → `App` (1747) → visible 1973. The JSON is two serial hops (chunk, then JSON) in front of the entry. Nothing overlaps.
- **c:** App Host `App` (1207) → `use-cases.json` starts at 1319, right after `App` evaluates, and the `load-use-case-json` chunk starts at 1323. The two overlap. Entry (1426) → init (1532) → `App` (1640) → visible 1872. The JSON still sits in front of the entry, so c is about one hop (about 100 ms) behind a, not two.
- **d:** `remoteEntry` for Use case A starts during App Host's init (1219), before App Host's own `App` chunk (1436). Use case A's entry and init chunks run first, so App Host's `App` waits behind them (App Host's `App` is at 1218 in a). Then the static route chunk (`load-static`, 1545) and the generated wrapper (1650) run serially, and Use case A `App` starts at 1757 → visible 1972. The eager fetch moves the cost to the catalog and does not shorten the direct visit.
- **e:** No eager fetch. App Host `App` (1233) → `load-static` (1345) → wrapper (1451) → entry (1558) → init (1664) → `App` (1773) → visible 1990. Same serial chain as d, minus the early entry.

Reading: on a direct visit the default has one serial chain of two remote hops after App Host's `App`. Each extra indirection (a JSON fetch, a route chunk or the static wrapper) costs about one simulated round trip. Eager fetching (d) does not save anything on the direct visit, because it makes App Host's own `App` wait for the entry.

Mechanism for d (inferred from the timeline, consistent with [results-static-remotes.md](results-static-remotes.md)): the eager entry is requested by App Host's init, and App Host's `App` chunk starts only after init resolves. The init is the one that fetches Use case A's entry, so App Host's own chunk is delayed by the entry hop.

## Differences against the noise

Medians are compared with min-max ranges (n=7). "Clearly apart" means the ranges do not overlap.

- **a vs c:** clearly apart (a max 1787, c min 1847). Gap about 100 ms, which equals one simulated round trip.
- **a vs b, d, e:** clearly apart. Gaps of about 200 ms (b +216, d +201, e +199). The three static or JSON-chain variants are slower than a by about two round trips.
- **c vs d and c vs e:** c is faster. The ranges do not overlap, and the medians are about 100 ms apart.
- **b, d, e among themselves:** the ranges overlap (b 1962-2009, d 1950-1987, e 1954-1990). Not distinguishable.
- **At 0 ms latency:** all five are 345-349 ms medians with overlapping ranges. No difference.

So: the default is the fastest on a direct visit. Its lead over c is clear at n=7 on localhost, but it is only one simulated round trip. Whether that matters on a real network (where RTT, TLS and DNS add to it) is not measured.

## Caveats

- Localhost, one machine, one browser (headless `chrome-headless-shell`). No CPU throttling.
- Latency is simulated with CDP (added per request). There is no bandwidth limit and no real DNS, TLS or CDN. The round-trip cost in the waterfall is therefore a model, not a measurement of a real network.
- n=7 cold runs per cell, medians and min-max. No significance test. Min-max is the only noise estimate.
- Production build only. Dev was not measured. Variants b/c need `dist/use-cases.json`, which is only written at build time, so they do not run under `vite` dev.
- Cold cache means a new browser context with the HTTP cache disabled. It does not model a warm service worker or a CDN cache.
- The catalog numbers come from one visit per variant. They are counts, not timings.
- Not measured: failure and retry behaviour for b, c and e (the early fetch in c is reused on Retry, see the shortcut comment in `load-use-case-json.ts`), a `strictVersion` mismatch under `loaded-first` (e), real network latency, bandwidth-limited loads, and more than one machine.
- e's `loaded-first` change was measured with identical shared versions only (as in [results-static-remotes.md](results-static-remotes.md)).
