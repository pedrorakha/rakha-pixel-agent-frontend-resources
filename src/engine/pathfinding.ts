import { Point } from "./types";

interface BFSNode {
  x: number;
  y: number;
  parent: BFSNode | null;
}

const DIRECTIONS: Point[] = [
  { x: 0, y: -1 }, // up
  { x: 1, y: 0 },  // right
  { x: 0, y: 1 },  // down
  { x: -1, y: 0 }, // left
];

function makeKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function findPath(
  collisionMap: boolean[][],
  start: Point,
  end: Point
): Point[] {
  const height = collisionMap.length;
  if (height === 0) return [];
  const width = collisionMap[0].length;

  if (
    start.x < 0 || start.x >= width ||
    start.y < 0 || start.y >= height ||
    end.x < 0 || end.x >= width ||
    end.y < 0 || end.y >= height
  ) {
    return [];
  }

  if (collisionMap[end.y][end.x]) {
    return [];
  }

  if (start.x === end.x && start.y === end.y) {
    return [{ x: start.x, y: start.y }];
  }

  const visited = new Set<string>();
  const queue: BFSNode[] = [];

  const startNode: BFSNode = { x: start.x, y: start.y, parent: null };
  queue.push(startNode);
  visited.add(makeKey(start.x, start.y));

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path: Point[] = [];
      let node: BFSNode | null = current;
      while (node !== null) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const key = makeKey(nx, ny);

      if (
        nx >= 0 && nx < width &&
        ny >= 0 && ny < height &&
        !collisionMap[ny][nx] &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push({ x: nx, y: ny, parent: current });
      }
    }
  }

  return []; // No path found
}

export function buildCollisionMap(
  tiles: number[][],
  wallTileId: number
): boolean[][] {
  return tiles.map((row) => row.map((tile) => tile === wallTileId));
}
