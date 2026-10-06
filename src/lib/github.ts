import {
  githubCommitSchema,
  githubContributorSchema,
  githubEventSchema,
  githubIssueSchema,
  githubPullRequestSchema,
  githubRepoSchema,
  repoQuerySchema,
  type RepoInsightResponse,
} from "./schemas.ts";
import { z } from "zod";

const GITHUB_API_BASE = "https://api.github.com";

// Typed failures let the route distinguish user mistakes from upstream outages.
export class InsightsError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type GitHubHeaders = {
  remaining: number | null;
  resetAt: string | null;
  link: string | null;
};

// This helper normalizes either "owner/repo" input or a pasted GitHub URL into one canonical format.
export function normalizeRepoInput(rawRepo: string) {
  const parsed = repoQuerySchema.safeParse({ repo: rawRepo });
  const invalid = () => new InsightsError("Use owner/repo or https://github.com/owner/repo.", 400);
  if (!parsed.success) throw invalid();
  let value = parsed.data.repo;
  if (value.includes(":")) {
    let url: URL;
    try { url = new URL(value); } catch { throw invalid(); }
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) throw invalid();
    value = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  const segments = value.split("/");
  if (segments.length !== 2) throw invalid();
  const [owner, rawName] = segments;
  const repo = rawName.replace(/\.git$/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(repo) || repo === "." || repo === "..") throw invalid();
  return { owner, repo, fullName: `${owner}/${repo}` };
}

// This helper builds a GitHub request with the headers needed for JSON responses and optional auth later.
async function fetchGitHubJson<T>(
  path: string,
  emptyStatus?: number,
): Promise<{ data: T; headers: GitHubHeaders }> {
  const token = process.env.GITHUB_TOKEN;
  let response: Response;
  try {
    let url = new URL(path, GITHUB_API_BASE);
    const signal = AbortSignal.timeout(12000);
    // Moved repositories redirect inside GitHub. Never forward credentials to another origin.
    for (let redirects = 0; ; redirects++) {
      response = await fetch(url.href, {
        signal,
        redirect: "manual",
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 900 },
      });
      if (![301, 302, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirects >= 3) throw new Error("Invalid redirect");
      const nextUrl = new URL(location, url);
      if (nextUrl.origin !== GITHUB_API_BASE || nextUrl.username || nextUrl.password) throw new Error("Invalid redirect");
      url = nextUrl;
    }
  } catch {
    throw new InsightsError("GitHub could not be reached. Please try again shortly.", 503);
  }

  const headers = {
    remaining: response.headers.get("x-ratelimit-remaining")
      ? Number(response.headers.get("x-ratelimit-remaining"))
      : null,
    resetAt: response.headers.get("x-ratelimit-reset")
      ? new Date(Number(response.headers.get("x-ratelimit-reset")) * 1000).toISOString()
      : null,
    link: response.headers.get("link"),
  };

  if (response.status === 404) {
    throw new InsightsError("Public repository not found. Check the owner and repo name.", 404);
  }

  if (response.status === 429 || (response.status === 403 && (headers.remaining === 0 || response.headers.has("retry-after")))) {
    throw new InsightsError("GitHub API rate limit reached. Please try again later.", 429);
  }

  if (response.status === 204 || response.status === emptyStatus) return { data: [] as T, headers };

  if (!response.ok) {
    throw new InsightsError("GitHub could not provide repository data. Please try again later.", 502);
  }

  return {
    data: (await response.json()) as T,
    headers,
  };
}

// This helper reads GitHub pagination metadata so we can estimate counts without downloading every page.
export function getPaginatedCount(linkHeader: string | null, fallbackCount: number) {
  if (!linkHeader) {
    return fallbackCount;
  }

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="last"/);
    if (match) return Number(new URL(match[1]).searchParams.get("page")) || fallbackCount;
  }

  return fallbackCount;
}

// This helper converts GitHub's language byte map into sorted chart-ready percentages.
function buildLanguageBreakdown(languageMap: Record<string, number>) {
  const totalBytes = Object.values(languageMap).reduce((sum, value) => sum + value, 0);

  if (!totalBytes) {
    return [];
  }

  return Object.entries(languageMap)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: Number(((bytes / totalBytes) * 100).toFixed(1)),
    }))
    .sort((left, right) => right.bytes - left.bytes);
}

// This helper buckets recent commits by week so the chart highlights momentum rather than noisy daily spikes.
export function buildCommitActivity(commits: Array<{ commit: { committer: { date: string } } }>, now = new Date()) {
  const weekCounts = new Map<string, number>();
  // Include all twelve calendar weeks so gaps reset streaks and count in averages.
  const currentMonday = new Date(now);
  currentMonday.setUTCDate(now.getUTCDate() - (now.getUTCDay() + 6) % 7);
  currentMonday.setUTCHours(0, 0, 0, 0);
  for (let offset = 11; offset >= 0; offset--) {
    weekCounts.set(new Date(currentMonday.getTime() - offset * 7 * 86400000).toISOString(), 0);
  }

  for (const item of commits) {
    const date = new Date(item.commit.committer.date);
    if (!Number.isFinite(date.getTime()) || date > now) continue;
    const dayOffset = (date.getUTCDay() + 6) % 7;
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - dayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const key = weekStart.toISOString();
    if (weekCounts.has(key)) weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }

  return Array.from(weekCounts.entries())
    .map(([weekStart, commitsInWeek]) => ({
      weekStart,
      commits: commitsInWeek,
    }))
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
    .slice(-12);
}

// This helper turns GitHub event payloads into concise activity feed descriptions for the dashboard.
function summarizeEvent(event: {
  type: string;
  payload?: Record<string, unknown>;
}) {
  switch (event.type) {
    case "PushEvent": {
      const commitCount = Array.isArray(event.payload?.commits)
        ? event.payload?.commits.length
        : null;
      return commitCount ? `Pushed ${commitCount} commit${commitCount === 1 ? "" : "s"}.` : "Pushed new commits.";
    }
    case "PullRequestEvent":
      return "Updated a pull request.";
    case "IssuesEvent":
      return "Touched an issue.";
    case "IssueCommentEvent":
      return "Commented on an issue.";
    case "WatchEvent":
      return "Received a new star.";
    case "ForkEvent":
      return "Repository was forked.";
    case "CreateEvent":
      return "Created a branch or tag.";
    default:
      return event.type.replace(/Event$/, "");
  }
}

// This activity score is descriptive, not a prediction of quality or maintenance.
function buildHealthSummary(input: {
  archived: boolean;
  commitsLast90Days: number;
  mergedPullRequestsLast30Days: number;
}) {
  const commitPoints = Math.min(60, input.commitsLast90Days * 3);
  const mergePoints = Math.min(40, input.mergedPullRequestsLast30Days * 4);
  return {
    score: input.archived ? 0 : commitPoints + mergePoints,
    label: input.archived ? "Archived" : "Sample activity",
    reasons: [
      `Commit sample: ${commitPoints}/60 points (3 per commit within 90 days, capped at 60).`,
      `PR sample: ${mergePoints}/40 points (4 per merge within 30 days, capped at 40).`,
      "Archived repositories score zero. Stars, backlog size, and contributor count do not affect this score.",
      "Samples can undercount activity. This is not a measure of quality, security, or maintainer responsiveness.",
    ],
  };
}

// This helper computes a simple weekly streak metric that rewards consistent output over raw volume.
export function getLongestWeeklyStreak(commitActivity: RepoInsightResponse["commitActivity"]) {
  let longest = 0;
  let current = 0;

  for (const week of commitActivity) {
    if (week.commits > 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

// This helper lets us compare issue and PR activity as one simple recent collaboration velocity signal.
function getIssuePullRequestVelocity(issuesUpdatedLast30Days: number, pullRequestsUpdatedLast30Days: number) {
  return issuesUpdatedLast30Days + pullRequestsUpdatedLast30Days;
}

// This helper summarizes the labels that show up most often in the recent issue sample.
function buildTopLabels(issues: Array<{ labels: Array<{ name: string }> }>) {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    for (const label of issue.labels) {
      counts.set(label.name, (counts.get(label.name) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

// This helper computes how quickly recently merged pull requests moved from open to merged.
function getAverageMergeHours(pullRequests: Array<{ created_at: string; merged_at: string | null }>) {
  const mergedDurations = pullRequests
    .filter((pullRequest) => pullRequest.merged_at)
    .map((pullRequest) => {
      return (
        new Date(pullRequest.merged_at as string).getTime() -
        new Date(pullRequest.created_at).getTime()
      ) / (1000 * 60 * 60);
    });

  if (!mergedDurations.length) {
    return null;
  }

  return Number(
    (
      mergedDurations.reduce((sum, hours) => sum + hours, 0) / mergedDurations.length
    ).toFixed(1),
  );
}

// This helper compares recently opened and recently closed issues so the health heuristic can reason about throughput.
export function getIssueResolutionRate(issues: Array<{ created_at: string; closed_at: string | null }>) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const recentlyOpened = issues.filter((issue) => now - new Date(issue.created_at).getTime() <= thirtyDaysMs).length;
  const recentlyClosed = issues.filter(
    (issue) => issue.closed_at && now - new Date(issue.closed_at).getTime() <= thirtyDaysMs,
  ).length;

  if (!recentlyOpened) {
    return null;
  }

  return Number((recentlyClosed / recentlyOpened).toFixed(2));
}

// This main function fetches public GitHub data, validates it, and transforms it into dashboard-ready insight objects.
export async function getRepoInsights(rawRepo: string): Promise<RepoInsightResponse> {
  let normalized = normalizeRepoInput(rawRepo);
  // Verify visibility before fetching any detail with a potentially privileged token.
  const repoResult = await fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}`);
  const repo = githubRepoSchema.parse(repoResult.data);
  if (repo.private || repo.visibility !== "public") throw new InsightsError("Public repository not found. Check the owner and repo name.", 404);
  normalized = normalizeRepoInput(repo.full_name);

  const [languageResult, contributorResult, commitResult, eventResult, issueResult, pullRequestResult, openPullRequestCountResult] =
    await Promise.all([
      fetchGitHubJson<Record<string, number>>(`/repos/${normalized.owner}/${normalized.repo}/languages`),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/contributors?per_page=5`),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/commits?per_page=100`, 409),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/events?per_page=12`),
      fetchGitHubJson(
        `/repos/${normalized.owner}/${normalized.repo}/issues?state=all&sort=updated&direction=desc&per_page=30`,
      ),
      fetchGitHubJson(
        `/repos/${normalized.owner}/${normalized.repo}/pulls?state=all&sort=updated&direction=desc&per_page=30`,
      ),
      fetchGitHubJson(
        `/repos/${normalized.owner}/${normalized.repo}/pulls?state=open&per_page=1`,
      ),
    ]);

  const contributors = githubContributorSchema.array().parse(contributorResult.data);
  const commits = githubCommitSchema.array().parse(commitResult.data);
  const events = githubEventSchema.array().parse(eventResult.data);
  const issues = githubIssueSchema.array().parse(issueResult.data).filter((issue) => !issue.pull_request);
  const pullRequests = githubPullRequestSchema.array().parse(pullRequestResult.data);

  const languageBreakdown = buildLanguageBreakdown(z.record(z.string(), z.number().nonnegative()).parse(languageResult.data));
  const commitActivity = buildCommitActivity(commits);
  const openPullRequests = getPaginatedCount(
    openPullRequestCountResult.headers.link,
    z.array(z.unknown()).parse(openPullRequestCountResult.data).length,
  );
  const openIssues = Math.max(0, repo.open_issues_count - openPullRequests);
  const commitsLast30Days = commits.filter((item) => {
    const age = Date.now() - new Date(item.commit.committer.date).getTime();
    return age >= 0 && age <= 30 * 86400000;
  }).length;
  const commitsLast90Days = commits.filter((item) => {
    const age = Date.now() - new Date(item.commit.committer.date).getTime();
    return age >= 0 && age <= 90 * 86400000;
  }).length;
  const averageCommitsPerWeek = commitActivity.length
    ? Number(
        (
          commitActivity.reduce((sum, week) => sum + week.commits, 0) / commitActivity.length
        ).toFixed(1),
      )
    : 0;
  const issuesUpdatedLast30Days = issues.filter((issue) => {
    return Date.now() - new Date(issue.updated_at).getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const pullRequestsUpdatedLast30Days = pullRequests.filter((pullRequest) => {
    return Date.now() - new Date(pullRequest.updated_at).getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const mergedPullRequestsLast30Days = pullRequests.filter((pullRequest) => {
    return (
      pullRequest.merged_at &&
      Date.now() - new Date(pullRequest.merged_at).getTime() <= 30 * 24 * 60 * 60 * 1000
    );
  }).length;
  const averagePullRequestMergeHours = getAverageMergeHours(pullRequests.filter(pr => pr.merged_at && Date.now() - new Date(pr.merged_at).getTime() <= 30 * 86400000));
  const issueResolutionRate = getIssueResolutionRate(issues);

  const health = buildHealthSummary({
    archived: repo.archived,
    commitsLast90Days,
    mergedPullRequestsLast30Days,
  });

  return {
    sampling: { commits: commits.length, commitsTruncated: !!commitResult.headers.link?.includes('rel="next"'), issues: issues.length, pullRequests: pullRequests.length, fetchedAt: new Date().toISOString() },
    repo: {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
        url: repo.owner.html_url,
      },
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.subscribers_count ?? repo.watchers_count,
      openIssues,
      primaryLanguage: repo.language,
      defaultBranch: repo.default_branch,
      archived: repo.archived,
      visibility: repo.visibility,
      sizeKb: repo.size,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
    },
    languageBreakdown,
    commitActivity,
    contributors: contributors.map((contributor) => ({
      login: contributor.login,
      avatarUrl: contributor.avatar_url,
      profileUrl: contributor.html_url,
      contributions: contributor.contributions,
    })),
    recentActivity: events.map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor.login,
      createdAt: event.created_at,
      summary: summarizeEvent(event),
    })),
    collaboration: {
      openIssues,
      openPullRequests,
      issuesUpdatedLast30Days,
      pullRequestsUpdatedLast30Days,
      mergedPullRequestsLast30Days,
      averagePullRequestMergeHours,
      issueResolutionRate,
      topLabels: buildTopLabels(issues),
      recentIssues: issues.slice(0, 5).map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        updatedAt: issue.updated_at,
        author: issue.user?.login ?? "Deleted account",
      })),
      recentPullRequests: pullRequests.slice(0, 5).map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        state: pullRequest.state,
        updatedAt: pullRequest.updated_at,
        author: pullRequest.user?.login ?? "Deleted account",
        mergedAt: pullRequest.merged_at,
      })),
    },
    health,
    derived: {
      commitsLast30Days,
      commitsLast90Days,
      contributorCount: contributors.length,
      averageCommitsPerWeek,
      longestWeeklyStreak: getLongestWeeklyStreak(commitActivity),
      issuePullRequestVelocity: getIssuePullRequestVelocity(
        issuesUpdatedLast30Days,
        pullRequestsUpdatedLast30Days,
      ),
    },
    rateLimit: repoResult.headers,
  };
}
