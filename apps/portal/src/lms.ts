import type { Lms } from "./types.ts";

export const lmsNames: Record<Lms, string> = {
  moodle: "Moodle",
  canvas: "Canvas",
  blackboard: "Blackboard",
};
export function isLms(value: string): value is Lms {
  return value === "moodle" || value === "canvas" || value === "blackboard";
}
export const BLACKBOARD_NOT_READY =
  "Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.";
