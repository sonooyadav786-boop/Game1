import { Structure, StructureType, UpgradeType } from '../types';

export interface Point2D {
  x: number;
  z: number;
}

export interface ObstacleBox {
  id: string;
  x: number;
  z: number;
  hx: number; // Half-width along X
  hz: number; // Half-depth along Z
  isCircular?: boolean;
  radius?: number;
}

// World navigation bounds & grid resolution
const WORLD_MIN = -24;
const WORLD_MAX = 24;
const CELL_SIZE = 0.5;
const GRID_DIM = Math.floor((WORLD_MAX - WORLD_MIN) / CELL_SIZE); // 96x96

// Static village buildings and landmarks
const STATIC_OBSTACLES: ObstacleBox[] = [
  // Houses
  { id: 'kacha-ghar', x: -6.5, z: -6, hx: 2.7, hz: 2.2 },
  { id: 'tulsi-chaura', x: -4.7, z: -3.5, hx: 0.7, hz: 0.7 },
  { id: 'pakka-ghar', x: -15, z: -8, hx: 3.0, hz: 2.4 },
  { id: 'chhappar-ghar', x: 15, z: -6, hx: 2.4, hz: 2.0 },
  // Mandir, Well, Market, Chai Tapri, Chulha, Charpai, Rules Board
  { id: 'mandir', x: 0, z: -14, hx: 2.85, hz: 2.85 },
  { id: 'well', x: 6, z: -6, hx: 1.35, hz: 1.35, isCircular: true, radius: 1.35 },
  { id: 'talab', x: -14, z: 8.5, hx: 5.9, hz: 5.9, isCircular: true, radius: 5.9 },
  { id: 'market-stall', x: 9, z: 1.5, hx: 1.85, hz: 1.15 },
  { id: 'chai-tapri', x: 14, z: 2, hx: 1.35, hz: 0.85 },
  { id: 'khat-charpai', x: -7.8, z: -3.2, hx: 1.0, hz: 0.6 },
  { id: 'rules-board', x: -6.2, z: 2.2, hx: 0.95, hz: 0.35 },
  // Vehicles on road
  { id: 'tempo', x: 3, z: 14.5, hx: 1.0, hz: 1.45 },
  { id: 'roadways-bus', x: -18, z: 17, hx: 1.45, hz: 3.7 }
];

export function getStructureHalfExtents(type: StructureType): { hx: number; hz: number; isCircular?: boolean; radius?: number } {
  switch (type) {
    case StructureType.COWSHED:
      return { hx: 1.85, hz: 1.55 };
    case StructureType.CHICKEN_COOP:
      return { hx: 1.05, hz: 0.95 };
    case StructureType.GRAIN_SILO:
      return { hx: 1.1, hz: 1.1, isCircular: true, radius: 1.1 };
    default:
      return { hx: 1.2, hz: 1.2 };
  }
}

export function getAllObstacles(structures: Structure[] = [], upgrades: UpgradeType[] = []): ObstacleBox[] {
  const dynamicObstacles: ObstacleBox[] = structures.map((s) => {
    const ext = getStructureHalfExtents(s.type);
    return {
      id: `struct-${s.id}`,
      x: s.x,
      z: s.z,
      hx: ext.hx,
      hz: ext.hz,
      isCircular: ext.isCircular,
      radius: ext.radius
    };
  });

  if (upgrades.includes(UpgradeType.SCARECROW)) {
    dynamicObstacles.push({
      id: 'upgrade-scarecrow',
      x: 0,
      z: -4.5,
      hx: 0.45,
      hz: 0.45,
      isCircular: true,
      radius: 0.45
    });
  }

  return [...STATIC_OBSTACLES, ...dynamicObstacles];
}

export function isPointBlocked(
  x: number,
  z: number,
  obstacles: ObstacleBox[],
  clearance: number = 0.42
): boolean {
  if (x < WORLD_MIN + 0.5 || x > WORLD_MAX - 0.5 || z < WORLD_MIN + 0.5 || z > WORLD_MAX - 0.5) {
    return true;
  }

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (obs.isCircular && obs.radius !== undefined) {
      const dx = x - obs.x;
      const dz = z - obs.z;
      const r = obs.radius + clearance;
      if (dx * dx + dz * dz < r * r) {
        return true;
      }
    } else {
      if (
        Math.abs(x - obs.x) < obs.hx + clearance &&
        Math.abs(z - obs.z) < obs.hz + clearance
      ) {
        return true;
      }
    }
  }
  return false;
}

export function findNearestWalkablePoint(
  target: Point2D,
  obstacles: ObstacleBox[],
  clearance: number = 0.42
): Point2D {
  if (!isPointBlocked(target.x, target.z, obstacles, clearance)) {
    return target;
  }

  // Spiral search outward to find closest valid coordinate
  for (let radius = 0.4; radius <= 8.0; radius += 0.4) {
    const steps = Math.max(8, Math.floor(radius * 12));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const cx = target.x + Math.cos(angle) * radius;
      const cz = target.z + Math.sin(angle) * radius;
      if (!isPointBlocked(cx, cz, obstacles, clearance)) {
        return { x: cx, z: cz };
      }
    }
  }

  return { x: 0, z: 2 };
}

export function hasLineOfSight(
  a: Point2D,
  b: Point2D,
  obstacles: ObstacleBox[],
  clearance: number = 0.42
): boolean {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  if (dist < 0.05) return true;
  const steps = Math.ceil(dist / 0.22);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = a.x + (b.x - a.x) * t;
    const pz = a.z + (b.z - a.z) * t;
    if (isPointBlocked(px, pz, obstacles, clearance)) {
      return false;
    }
  }
  return true;
}

function worldToGrid(x: number, z: number): { gx: number; gz: number } {
  const gx = Math.max(0, Math.min(GRID_DIM - 1, Math.floor((x - WORLD_MIN) / CELL_SIZE)));
  const gz = Math.max(0, Math.min(GRID_DIM - 1, Math.floor((z - WORLD_MIN) / CELL_SIZE)));
  return { gx, gz };
}

function gridToWorld(gx: number, gz: number): Point2D {
  return {
    x: WORLD_MIN + (gx + 0.5) * CELL_SIZE,
    z: WORLD_MIN + (gz + 0.5) * CELL_SIZE
  };
}

/**
 * Computes a smooth, obstacle-avoiding A* path from `start` to `goal` around all static and placed structures.
 */
export function findPathAroundStructures(
  start: Point2D,
  goal: Point2D,
  structures: Structure[] = [],
  upgrades: UpgradeType[] = [],
  clearance: number = 0.42
): Point2D[] {
  const obstacles = getAllObstacles(structures, upgrades);
  const safeStart = findNearestWalkablePoint(start, obstacles, clearance);
  const safeGoal = findNearestWalkablePoint(goal, obstacles, clearance);

  // Fast path: if straight line is completely clear, go directly!
  if (hasLineOfSight(safeStart, safeGoal, obstacles, clearance)) {
    return [safeGoal];
  }

  const startCell = worldToGrid(safeStart.x, safeStart.z);
  const goalCell = worldToGrid(safeGoal.x, safeGoal.z);

  const startIdx = startCell.gz * GRID_DIM + startCell.gx;
  const goalIdx = goalCell.gz * GRID_DIM + goalCell.gx;

  if (startIdx === goalIdx) {
    return [safeGoal];
  }

  const totalCells = GRID_DIM * GRID_DIM;
  const gScore = new Float32Array(totalCells).fill(Infinity);
  const fScore = new Float32Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);
  const blockedCache = new Int8Array(totalCells).fill(-1); // -1 unknown, 0 free, 1 blocked

  const isCellBlocked = (gx: number, gz: number): boolean => {
    if (gx < 0 || gx >= GRID_DIM || gz < 0 || gz >= GRID_DIM) return true;
    const idx = gz * GRID_DIM + gx;
    if (idx === startIdx || idx === goalIdx) return false;
    if (blockedCache[idx] !== -1) return blockedCache[idx] === 1;
    const pt = gridToWorld(gx, gz);
    const blocked = isPointBlocked(pt.x, pt.z, obstacles, clearance);
    blockedCache[idx] = blocked ? 1 : 0;
    return blocked;
  };

  const heuristic = (gx: number, gz: number): number => {
    const dx = Math.abs(gx - goalCell.gx);
    const dz = Math.abs(gz - goalCell.gz);
    return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz);
  };

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startCell.gx, startCell.gz);

  // Binary min-heap open set for fast A* search
  const openHeap: number[] = [startIdx];
  const inOpen = new Uint8Array(totalCells);
  inOpen[startIdx] = 1;

  const pushOpen = (idx: number) => {
    openHeap.push(idx);
    let i = openHeap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (fScore[openHeap[i]] < fScore[openHeap[parent]]) {
        const tmp = openHeap[i];
        openHeap[i] = openHeap[parent];
        openHeap[parent] = tmp;
        i = parent;
      } else {
        break;
      }
    }
  };

  const popOpen = (): number => {
    const top = openHeap[0];
    const last = openHeap.pop()!;
    if (openHeap.length > 0) {
      openHeap[0] = last;
      let i = 0;
      const len = openHeap.length;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < len && fScore[openHeap[left]] < fScore[openHeap[smallest]]) smallest = left;
        if (right < len && fScore[openHeap[right]] < fScore[openHeap[smallest]]) smallest = right;
        if (smallest !== i) {
          const tmp = openHeap[i];
          openHeap[i] = openHeap[smallest];
          openHeap[smallest] = tmp;
          i = smallest;
        } else {
          break;
        }
      }
    }
    return top;
  };

  const dirs = [
    { dx: 0, dz: -1, cost: 1 },
    { dx: 1, dz: 0, cost: 1 },
    { dx: 0, dz: 1, cost: 1 },
    { dx: -1, dz: 0, cost: 1 },
    { dx: 1, dz: -1, cost: 1.4142 },
    { dx: 1, dz: 1, cost: 1.4142 },
    { dx: -1, dz: 1, cost: 1.4142 },
    { dx: -1, dz: -1, cost: 1.4142 }
  ];

  let closestIdx = startIdx;
  let closestDist = heuristic(startCell.gx, startCell.gz);
  let iterations = 0;
  const maxIterations = 2600;

  while (openHeap.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = popOpen();
    if (current === goalIdx) {
      closestIdx = goalIdx;
      break;
    }

    if (closed[current]) continue;
    closed[current] = 1;

    const cgx = current % GRID_DIM;
    const cgz = Math.floor(current / GRID_DIM);

    const h = heuristic(cgx, cgz);
    if (h < closestDist) {
      closestDist = h;
      closestIdx = current;
    }

    for (let d = 0; d < dirs.length; d++) {
      const dir = dirs[d];
      const ngx = cgx + dir.dx;
      const ngz = cgz + dir.dz;

      if (isCellBlocked(ngx, ngz)) continue;

      // Prevent diagonal corner-cutting across structure edges
      if (dir.dx !== 0 && dir.dz !== 0) {
        if (isCellBlocked(cgx + dir.dx, cgz) || isCellBlocked(cgx, cgz + dir.dz)) {
          continue;
        }
      }

      const nIdx = ngz * GRID_DIM + ngx;
      if (closed[nIdx]) continue;

      const tentativeG = gScore[current] + dir.cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + heuristic(ngx, ngz);
        if (!inOpen[nIdx]) {
          inOpen[nIdx] = 1;
          pushOpen(nIdx);
        } else {
          pushOpen(nIdx);
        }
      }
    }
  }

  // Reconstruct raw grid path
  const rawPath: Point2D[] = [];
  let curr = closestIdx;
  while (curr !== -1 && curr !== startIdx) {
    const gx = curr % GRID_DIM;
    const gz = Math.floor(curr / GRID_DIM);
    rawPath.push(gridToWorld(gx, gz));
    curr = cameFrom[curr];
  }
  rawPath.reverse();

  if (closestIdx === goalIdx) {
    rawPath[rawPath.length - 1] = safeGoal;
  }

  if (rawPath.length <= 1) {
    return [safeGoal];
  }

  // Line-of-Sight String-Pulling Smoothing so movement is natural and organic
  const fullChain = [safeStart, ...rawPath];
  const smoothed: Point2D[] = [];
  let anchor = 0;

  while (anchor < fullChain.length - 1) {
    let furthest = anchor + 1;
    for (let test = fullChain.length - 1; test > anchor + 1; test--) {
      if (hasLineOfSight(fullChain[anchor], fullChain[test], obstacles, clearance * 0.9)) {
        furthest = test;
        break;
      }
    }
    smoothed.push(fullChain[furthest]);
    anchor = furthest;
  }

  return smoothed;
}

/**
 * Resolves continuous per-frame movement or keyboard WASD steps so entities slide smoothly around obstacles.
 */
export function resolveObstacleCollision(
  current: Point2D,
  desired: Point2D,
  structures: Structure[] = [],
  upgrades: UpgradeType[] = [],
  clearance: number = 0.4
): Point2D {
  const obstacles = getAllObstacles(structures, upgrades);
  if (!isPointBlocked(desired.x, desired.z, obstacles, clearance)) {
    return desired;
  }
  // Try sliding along X axis only
  if (!isPointBlocked(desired.x, current.z, obstacles, clearance)) {
    return { x: desired.x, z: current.z };
  }
  // Try sliding along Z axis only
  if (!isPointBlocked(current.x, desired.z, obstacles, clearance)) {
    return { x: current.x, z: desired.z };
  }
  // If current position itself became blocked (e.g., structure just placed on top), push out to nearest walkable point
  if (isPointBlocked(current.x, current.z, obstacles, clearance)) {
    return findNearestWalkablePoint(current, obstacles, clearance);
  }
  return current;
}
