import type { PhaseKey } from "@/lib/data/process";

/**
 * The stamp each phase's last sheet receives in the dossier. Every word comes from that
 * phase's own copy (lead or deliverables); nothing here is a new promise. Pending team approval.
 */
export const STAMPS: Record<PhaseKey, string> = {
  understand: "Senior feasibility review",
  design: "Acceptance criteria in writing",
  build: "Named senior review",
  launch: "Launch checklist passed",
  improve: "Documented for handover",
};

/** Small, fixed offsets so the pile looks hand-stacked; deterministic, so server and browser agree. */
export const PILE = [
  { dx: -6, rot: -2.4 },
  { dx: 5, rot: 1.6 },
  { dx: -2, rot: -0.8 },
  { dx: 7, rot: 2.2 },
  { dx: -5, rot: -1.7 },
  { dx: 3, rot: 1.1 },
  { dx: -7, rot: -2.6 },
  { dx: 4, rot: 0.9 },
  { dx: -3, rot: -1.2 },
  { dx: 6, rot: 2.4 },
  { dx: -4, rot: -1.9 },
  { dx: 2, rot: 1.4 },
  { dx: -6, rot: -0.6 },
  { dx: 5, rot: 1.9 },
  { dx: 0, rot: -1 },
] as const;
