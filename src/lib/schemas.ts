import { z } from "zod";

// This schema validates the repository input format before we ever touch the GitHub API.
export const repoQuerySchema = z.object({
  repo: z
    .string()
    .trim()
    .min(3, "Enter a repository in the format owner/repo or a GitHub URL."),
});

// These schemas validate the parts of the GitHub API response we actually rely on.
export const githubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  subscribers_count: z.number().optional().default(0),
  open_issues_count: z.number(),
  watchers_count: z.number(),
  language: z.string().nullable(),
  default_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string().nullable(),
  size: z.number(),
  archived: z.boolean(),
  forks: z.number(),
  visibility: z.string(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string().url(),
    html_url: z.string().url(),
  }),
});

export const githubContributorSchema = z.object({
  id: z.number(),
  login: z.string(),
  avatar_url: z.string().url(),
  html_url: z.string().url(),
  contributions: z.number(),
});

export const githubCommitSchema = z.object({
  sha: z.string(),
  html_url: z.string().url(),
  commit: z.object({
    message: z.string(),
    author: z.object({
      name: z.string(),
      date: z.string(),
    }),
  }),
  author: z
    .object({
      login: z.string(),
      avatar_url: z.string().url(),
      html_url: z.string().url(),
    })
    .nullable(),
});

export const githubEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created_at: z.string(),
  actor: z.object({
    login: z.string(),
    avatar_url: z.string().url().optional(),
  }),
  repo: z.object({
    name: z.string(),
  }),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

// These schemas describe the app's own API contract so the frontend and backend stay aligned.
export const repoInsightResponseSchema = z.object({
  repo: z.object({
    name: z.string(),
    fullName: z.string(),
    description: z.string().nullable(),
    url: z.string().url(),
    owner: z.object({
      login: z.string(),
      avatarUrl: z.string().url(),
      url: z.string().url(),
    }),
    stars: z.number(),
    forks: z.number(),
    watchers: z.number(),
    openIssues: z.number(),
    primaryLanguage: z.string().nullable(),
    defaultBranch: z.string(),
    archived: z.boolean(),
    visibility: z.string(),
    sizeKb: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    pushedAt: z.string().nullable(),
  }),
  languageBreakdown: z.array(
    z.object({
      name: z.string(),
      bytes: z.number(),
      percent: z.number(),
    }),
  ),
  commitActivity: z.array(
    z.object({
      weekStart: z.string(),
      commits: z.number(),
    }),
  ),
  contributors: z.array(
    z.object({
      login: z.string(),
      avatarUrl: z.string().url(),
      profileUrl: z.string().url(),
      contributions: z.number(),
    }),
  ),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      actor: z.string(),
      createdAt: z.string(),
      summary: z.string(),
    }),
  ),
  health: z.object({
    score: z.number(),
    label: z.string(),
    reasons: z.array(z.string()),
  }),
  derived: z.object({
    commitsLast30Days: z.number(),
    commitsLast90Days: z.number(),
    contributorCount: z.number(),
    averageCommitsPerWeek: z.number(),
    longestWeeklyStreak: z.number(),
  }),
  rateLimit: z.object({
    remaining: z.number().nullable(),
    resetAt: z.string().nullable(),
  }),
});

export type RepoInsightResponse = z.infer<typeof repoInsightResponseSchema>;
