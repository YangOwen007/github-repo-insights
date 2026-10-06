import assert from "node:assert/strict";
import { test } from "node:test";
import { acquireRequestBudget } from "../src/lib/request-budget.ts";

// Verify saturation and release behavior without timers or external services.
test("fan-out is bounded, release is idempotent, and window budget resets", () => {
  const now = 120000;
  const releases = Array.from({ length: 4 }, () => acquireRequestBudget(now));
  assert.ok(releases.every(Boolean));
  assert.equal(acquireRequestBudget(now), null);
  releases[0]();
  releases[0]();
  const next = acquireRequestBudget(now);
  assert.ok(next);
  assert.equal(acquireRequestBudget(now), null);
  next();
  releases.forEach(release => release());
  for (let count = 5; count < 30; count++) {
    const release = acquireRequestBudget(now);
    assert.ok(release);
    release();
  }
  assert.equal(acquireRequestBudget(now), null);
  const reset = acquireRequestBudget(now + 60000);
  assert.ok(reset);
  reset();
});
