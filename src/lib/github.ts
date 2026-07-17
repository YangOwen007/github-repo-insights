import {
  githubCommitSchema,
  githubContributorSchema,
  githubEventSchema,
  githubRepoSchema,
  repoQuerySchema,
  type RepoInsightResponse,
} from "@/lib/schemas";

const GITHUB_API_BASE = "https://api.github.com";

type GitHubHeaders = {
  remaining: number | null;
  resetAt: string | null;
};

// This helper normalizes either "owner/repo" input or a pasted GitHub URL into one canonical format.
export function normalizeRepoInput(rawRepo: string) {
  const parsed = repoQuerySchema.parse({ repo: rawRepo });
  const value = parsed.repo.trim();

  if (value.includes("github.com")) {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length < 2) {
      throw new Error("GitHub URLs must include both an owner and repository name.");
    }

    return {
      owner: segments[0],
      repo: segments[1].replace(/\.git$/, ""),
      fullName: `${segments[0]}/${segments[1].replace(/\.git$/, "")}`,
    };
  }

  const [owner, repo] = value.split("/");

  if (!owner || !repo) {
    throw new Error("Use the format owner/repo, like vercel/next.js.");
  }

  return {
    owner,
    repo: repo.replace(/\.git$/, ""),
    fullName: `${owner}/${repo.replace(/\.git$/, "")}`,
  };
}

// This helper builds a GitHub request with the headers needed for JSON responses and optional auth later.
async function fetchGitHubJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; headers: GitHubHeaders }> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    next: { revalidate: 900 },
  });

  const headers = {
    remaining: response.headers.get("x-ratelimit-remaining")
      ? Number(response.headers.get("x-ratelimit-remaining"))
      : null,
    resetAt: response.headers.get("x-ratelimit-reset")
      ? new Date(Number(response.headers.get("x-ratelimit-reset")) * 1000).toISOString()
      : null,
  };

  if (response.status === 404) {
    throw new Error("Repository not found. Check the owner and repo name.");
  }

  if (response.status === 403 && headers.remaining === 0) {
    throw new Error("GitHub API rate limit reached. Try again later or add a token.");
  }

  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  return {
    data: (await response.json()) as T,
    headers,
  };
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
function buildCommitActivity(commits: Array<{ commit: { author: { date: string } } }>) {
  const weekCounts = new Map<string, number>();

  for (const item of commits) {
    const date = new Date(item.commit.author.date);
    const dayOffset = (date.getUTCDay() + 6) % 7;
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - dayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const key = weekStart.toISOString();
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
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

// This helper derives a lightweight health score that is simple to explain in interviews.
function buildHealthSummary(input: {
  archived: boolean;
  commitsLast90Days: number;
  contributorCount: number;
  openIssues: number;
  stars: number;
}) {
  const reasons: string[] = [];
  let score = 45;

  if (input.archived) {
    score -= 25;
    reasons.push("Archived repositories are harder to treat as actively maintained.");
  } else {
    score += 10;
    reasons.push("The repository is still active rather than archived.");
  }

  if (input.commitsLast90Days >= 20) {
    score += 18;
    reasons.push("Recent commit volume suggests steady development momentum.");
  } else if (input.commitsLast90Days >= 5) {
    score += 10;
    reasons.push("The repository shows some recent development activity.");
  } else {
    score -= 8;
    reasons.push("Low recent commit activity may indicate slower maintenance.");
  }

  if (input.contributorCount >= 5) {
    score += 12;
    reasons.push("Multiple contributors reduce project bus-factor risk.");
  } else if (input.contributorCount >= 2) {
    score += 6;
    reasons.push("There is more than one active contributor.");
  } else {
    reasons.push("A single core contributor can make the project fragile.");
  }

  if (input.openIssues <= 25) {
    score += 8;
    reasons.push("Open issue volume looks manageable for an MVP health heuristic.");
  } else if (input.openIssues >= 200) {
    score -= 6;
    reasons.push("A large open issue backlog can be a maintenance warning sign.");
  }

  if (input.stars >= 500) {
    score += 7;
    reasons.push("Strong community interest can be a positive trust signal.");
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const label =
    boundedScore >= 80
      ? "Strong"
      : boundedScore >= 60
        ? "Healthy"
        : boundedScore >= 40
          ? "Mixed"
          : "Needs Review";

  return {
    score: boundedScore,
    label,
    reasons,
  };
}

// This helper computes a simple weekly streak metric that rewards consistent output over raw volume.
function getLongestWeeklyStreak(commitActivity: RepoInsightResponse["commitActivity"]) {
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

// This main function fetches public GitHub data, validates it, and transforms it into dashboard-ready insight objects.
export async function getRepoInsights(rawRepo: string): Promise<RepoInsightResponse> {
  const normalized = normalizeRepoInput(rawRepo);

  const [repoResult, languageResult, contributorResult, commitResult, eventResult] =
    await Promise.all([
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}`),
      fetchGitHubJson<Record<string, number>>(`/repos/${normalized.owner}/${normalized.repo}/languages`),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/contributors?per_page=5`),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/commits?per_page=100`),
      fetchGitHubJson(`/repos/${normalized.owner}/${normalized.repo}/events?per_page=12`),
    ]);

  const repo = githubRepoSchema.parse(repoResult.data);
  const contributors = githubContributorSchema.array().parse(contributorResult.data);
  const commits = githubCommitSchema.array().parse(commitResult.data);
  const events = githubEventSchema.array().parse(eventResult.data);

  const languageBreakdown = buildLanguageBreakdown(languageResult.data);
  const commitActivity = buildCommitActivity(commits);
  const commitsLast30Days = commits.filter((item) => {
    return Date.now() - new Date(item.commit.author.date).getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const commitsLast90Days = commits.filter((item) => {
    return Date.now() - new Date(item.commit.author.date).getTime() <= 90 * 24 * 60 * 60 * 1000;
  }).length;
  const averageCommitsPerWeek = commitActivity.length
    ? Number(
        (
          commitActivity.reduce((sum, week) => sum + week.commits, 0) / commitActivity.length
        ).toFixed(1),
      )
    : 0;

  const health = buildHealthSummary({
    archived: repo.archived,
    commitsLast90Days,
    contributorCount: contributors.length,
    openIssues: repo.open_issues_count,
    stars: repo.stargazers_count,
  });

  return {
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
      openIssues: repo.open_issues_count,
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
    health,
    derived: {
      commitsLast30Days,
      commitsLast90Days,
      contributorCount: contributors.length,
      averageCommitsPerWeek,
      longestWeeklyStreak: getLongestWeeklyStreak(commitActivity),
    },
    rateLimit: repoResult.headers,
  };
}
