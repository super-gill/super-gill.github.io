'use strict';

// Each map defines land polygons in world coordinates.
// Polygons are arrays of {x,y} points (closed, CW winding).
// isLand(wx,wy) returns true if a world point is inside any land polygon.

// Point-in-polygon (ray casting)
function pip(poly, px, py) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// ── Coastal map ─────────────────────────────────────────────────────────────
// World is 12000×12000. Land runs along the top and left edges,
// forming an L-shaped coastline. The playable ocean is the lower-right.
// A peninsula juts into the sea to create interesting littoral geometry.
// Coordinates are world units.
const coastalMap = {
  name: "COASTAL PATROL",
  seaColour: "#daeaf7",
  land: [],
  playerSpawn: { wx: 4000, wy: 5000 },
  enemySpawnBias: { cx: 6000, cy: 7000 },
};

const maps = { coastal: coastalMap };
let activeMap = coastalMap;

export function setMap(name) { activeMap = maps[name] || coastalMap; }
export function getMap() { return activeMap; }
export function isLand(wx, wy) {
  for (const poly of activeMap.land) {
    if (pip(poly, wx, wy)) return true;
  }
  return false;
}
// Returns nearest non-land point (simple grid search, used for waypoint snapping)
export function snapToSea(wx, wy, step = 80) {
  if (!isLand(wx, wy)) return { wx, wy };
  for (let r = step; r < 1200; r += step) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const tx = wx + Math.cos(a) * r, ty = wy + Math.sin(a) * r;
      if (!isLand(tx, ty)) return { wx: tx, wy: ty };
    }
  }
  return { wx, wy }; // fallback
}
