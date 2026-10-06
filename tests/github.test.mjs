import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCommitActivity, getLongestWeeklyStreak, getPaginatedCount, getRepoInsights, getIssueResolutionRate, normalizeRepoInput } from "../src/lib/github.ts";
import { githubPullRequestSchema, repoInsightResponseSchema } from "../src/lib/schemas.ts";

// Synthetic fixtures cover API contracts without live credentials or network requests.
const date = new Date().toISOString();
const repo = {
  id: 1, name: "sample", full_name: "example/sample", description: null,
  html_url: "https://github.com/example/sample", stargazers_count: 0, forks_count: 0,
  subscribers_count: 0, open_issues_count: 0, watchers_count: 0, language: null,
  default_branch: "main", created_at: date, updated_at: date, pushed_at: null,
  size: 0, archived: false, forks: 0, visibility: "public", private: false,
  owner: { login: "example", avatar_url: "https://avatars.githubusercontent.com/u/1", html_url: "https://github.com/example" },
};
const pull = { id: 1, number: 1, title: "Example", html_url: "https://github.com/example/sample/pull/1", state: "closed", created_at: date, updated_at: date, closed_at: date, merged_at: null, user: null };

test("canonical input accepts repository names and HTTPS GitHub URLs", () => {
  for (const value of ["example/sample", " https://github.com/example/sample.git/ "]) {
    assert.equal(normalizeRepoInput(value).fullName, "example/sample");
  }
});

test("input rejects other hosts, credentials, traversal, suffix paths and oversized input", () => {
  for (const value of ["https://github.com.evil.test/a/b", "http://github.com/a/b", "https://user:pass@github.com/a/b", "a/b/issues", "a/..", "a/b?token=x", "https://github.com/a/b?q=x", "a/" + "x".repeat(301), "a%2fadmin/b"]) {
    assert.throws(() => normalizeRepoInput(value), error => error.status === 400);
  }
});

test("PR list schema accepts records without detail endpoint fields or a surviving author", () => {
  assert.equal(githubPullRequestSchema.parse(pull).number, 1);
});

test("calendar gaps reset streaks and twelve weeks include zeros", () => {
  const commits = ["2026-09-14T12:00:00Z", "2026-09-28T12:00:00Z", "2026-10-05T12:00:00Z"].map(date => ({ commit: { committer: { date } } }));
  const activity = buildCommitActivity(commits, new Date("2026-10-06T12:00:00Z"));
  assert.equal(activity.length, 12);
  assert.equal(activity.reduce((sum, week) => sum + week.commits, 0), 3);
  assert.equal(getLongestWeeklyStreak(activity), 2);
  assert.equal(activity.at(-3).commits, 0);
});

test("pagination count reads query order independently and empty list stays zero", () => {
  assert.equal(getPaginatedCount('<https://api.github.com/repos/a/b/pulls?page=72&per_page=1>; rel="last"', 1), 72);
  assert.equal(getPaginatedCount(null, 0), 0);
});

test("closure ratio without sampled intake is unknown, not fabricated 100 percent", () => {
  assert.equal(getIssueResolutionRate([{ created_at: "2020-01-01", closed_at: date }]), null);
});

// Restore global fetch after each case; these tests intentionally execute sequentially.
async function withFetch(fake, work) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { await work(); } finally { globalThis.fetch = original; }
}

test("private metadata prevents all follow-up requests even with server authentication", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return Response.json({ ...repo, private: true, visibility: "private" }); }, async () => {
    await assert.rejects(getRepoInsights("example/sample"), error => error.status === 404);
    assert.equal(calls, 1);
  });
});

test("empty repositories handle commits 409, contributors 204, closed PRs and no languages", async () => {
  await withFetch(async url => {
    if (url.endsWith("/sample")) return Response.json(repo);
    if (url.includes("/languages")) return Response.json({});
    if (url.includes("/commits")) return new Response(null, { status: 409 });
    if (url.includes("/contributors")) return new Response(null, { status: 204 });
    if (url.includes("/pulls?state=all")) return Response.json([pull]);
    return Response.json([]);
  }, async () => {
    const report = repoInsightResponseSchema.parse(await getRepoInsights("example/sample"));
    assert.equal(report.collaboration.openPullRequests, 0);
    assert.equal(report.derived.commitsLast30Days, 0);
    assert.equal(report.commitActivity.length, 12);
    assert.deepEqual(report.languageBreakdown, []);
  });
});

test("upstream failures use explicit HTTP categories", async () => {
  for (const [upstream, expected] of [[404, 404], [429, 429], [500, 502], [401, 502]]) {
    await withFetch(async () => new Response(null, { status: upstream }), async () => {
      await assert.rejects(getRepoInsights("example/sample"), error => error.status === expected);
    });
  }
});

test("network errors are sanitized and bounded requests inspect redirects manually", async () => {
  await withFetch(async (_url, options) => {
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal);
    throw new Error("sensitive internal failure");
  }, async () => {
    await assert.rejects(getRepoInsights("example/sample"), error => error.status === 503 && !error.message.includes("sensitive"));
  });
});

test("redirects to other origins never receive a follow-up request", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response(null, { status: 301, headers: { location: "https://evil.test/collect" } }); }, async () => {
    await assert.rejects(getRepoInsights("example/sample"), error => error.status === 503);
    assert.equal(calls, 1);
  });
});

test("same-origin redirect loops are bounded", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response(null, { status: 301, headers: { location: "https://api.github.com/repositories/1" } }); }, async () => {
    await assert.rejects(getRepoInsights("example/sample"), error => error.status === 503);
    assert.equal(calls, 4);
  });
});
