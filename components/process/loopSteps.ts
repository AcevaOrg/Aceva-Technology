import { phaseByKey } from "@/lib/data/process";

const build = phaseByKey("build");

/**
 * The loop inside Build, every week. Each note is quoted from Build's own copy (its lead and its
 * deliverables), so the diagram adds no new promise: no day names, no durations. Labels are the
 * short names the diagram uses and are pending team approval.
 */
export const WEEKLY_LOOP = [
  { label: "Build", note: "AI-accelerated development" },
  { label: "Senior review", note: "mandatory senior code review" },
  { label: "Working demo", note: build.receive[0] },
  { label: "In writing", note: build.receive[1] },
] as const;
