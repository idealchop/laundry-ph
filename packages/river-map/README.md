# @river/map

React web map for River apps: MapLibre GL JS + a self-hosted Philippines PMTiles archive, River teal style, Manrope labels.
No app-specific imports – bring your own pins.

## Install

```bash
npm i maplibre-gl pmtiles            # peer deps (react, react-dom too)
# add this package as a git dependency / workspace: "@river/map": "github:idealchop/river-maps#main" (path packages/river-map)
```

## Usage

```tsx
import { RiverMap, RIVER_STYLE_URL_V2026_10, type RiverMapHandle } from '@river/map';

const ref = useRef<RiverMapHandle>(null);

<RiverMap
  ref={ref}
  style={{ width: '100%', height: 360 }}
  styleUrl={RIVER_STYLE_URL_V2026_10}
  user={{ latitude: 14.55, longitude: 121.02 }}
  pins={shops.map((s) => ({ id: s.id, coords: s.coords, title: s.name, data: s }))}
  selectedId={selected}
  onSelect={setSelected}
  renderPin={(pin, on) => <MyShopPin shop={pin.data} selected={on} />}   // optional
  routeTo={selectedShop?.coords}
  routingUrl={process.env.ROUTING_URL /* River OSRM server; default is the OSRM demo = testing only */}
  onRouteInfo={(r) => setEta(r)}                                         // { km, minutes, mode: 'road'|'straight' }
  gestures="cooperative"                                                  // inside scrolling pages
  attribution={false}                                                     // only if credited on a Credits page
/>;

ref.current?.fitAll();
ref.current?.locate();
```

### Props

| prop | |
|---|---|
| `styleUrl` | River style JSON URL or object (see `/style`) |
| `user` | user location → blue dot, route origin, initial centre |
| `pins`, `selectedId`, `onSelect`, `renderPin` | markers; any React node via `renderPin` |
| `routeTo`, `routingUrl`, `onRouteInfo` | OSRM-compatible routing; falls back to a dashed straight line |
| `fitCoords`, `padding` | camera fit target and overlay insets |
| `gestures` | `greedy` (full-screen) or `cooperative` (two-finger) |
| `workerUrl` | for bundlers that can't bundle `maplibre-gl-worker.mjs` (Expo/Metro web: copy it to `/maplibre/` on the same origin) |
| `attribution` | compact OSM/Protomaps attribution (default on) |
| `colors` | override `RIVER_THEME` |
| `children(map)` | render extra layers / markers with the raw map |

Web only. For React Native use `@maplibre/maplibre-react-native` with the same style URL.
