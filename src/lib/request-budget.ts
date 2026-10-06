// A small per-process guard bounds concurrent GitHub fan-out and requests per minute.
// Serverless instances do not share this state; platform-level limits remain necessary for public scale.
let active = 0;
let windowStart = 0;
let requests = 0;

export function acquireRequestBudget(now = Date.now()): (() => void) | null {
  if (now - windowStart >= 60000) { windowStart = now; requests = 0; }
  if (active >= 4 || requests >= 30) return null;
  active++;
  requests++;
  let released = false;
  return () => {
    if (!released) { active--; released = true; }
  };
}
