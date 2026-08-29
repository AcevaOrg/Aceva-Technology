import fs from "fs";
import path from "path";

export interface SavedDirection {
  pulseId: string;
  lead: {
    name: string;
    contact: string;
    method: string;
  };
  context?: {
    intent?: string;
    industry?: string;
    business?: string;
    current?: string;
    scale?: string;
    market?: string;
    friction?: string[];
    goals?: string[];
    timeline?: string;
  };
  answers?: string[];
  recommendedModules?: string[];
  createdAt: string;
}

const FILE_PATH = path.join(process.cwd(), "knowledge", "savedDirections.json");

let memoryStore: Record<string, SavedDirection> = {};

function loadStore(): Record<string, SavedDirection> {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, "utf-8");
      memoryStore = JSON.parse(content);
    }
  } catch (err) {
    console.error("[directionStore] Failed to load directions:", err);
  }
  return memoryStore;
}

function saveStore(): void {
  try {
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(memoryStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[directionStore] Failed to save directions:", err);
  }
}

export function saveDirection(direction: SavedDirection): void {
  loadStore();
  memoryStore[direction.pulseId.toUpperCase()] = direction;
  saveStore();
}

export function getDirection(pulseId: string): SavedDirection | null {
  const store = loadStore();
  const key = pulseId.trim().toUpperCase();
  return store[key] || null;
}
