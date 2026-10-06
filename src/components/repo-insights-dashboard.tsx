"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Flame,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  Scale,
  Star,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { repoInsightResponseSchema, type RepoInsightResponse } from "@/lib/schemas";

const DEFAULT_REPO = "vercel/next.js";
const LANGUAGE_COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"];

// These formatting helpers keep the JSX focused on layout instead of repeated data cleanup logic.
function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFullDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

// This helper keeps time-to-merge readable in the collaboration panel.
function formatHours(value: number | null) {
  if (value === null) {
    return "Not enough data";
  }

  if (value < 24) {
    return `${value}h`;
  }

  return `${(value / 24).toFixed(1)}d`;
}

// This helper formats rate-style values for heuristics that compare recent issue intake versus resolution.
function formatPercent(value: number | null) {
  if (value === null) {
    return "Not enough data";
  }

  return `${value.toFixed(2)} closed/opened`;
}

// This generic section wrapper makes the dashboard easier to scan and keeps the visual language consistent.
function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-[28px] p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// This stat card is reused across the top summary strip to make the repo overview immediately understandable.
function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-[24px] p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

// This component coordinates the repository input, API fetching, and all dashboard rendering states.
export function RepoInsightsDashboard() {
  const [repoInput, setRepoInput] = useState(DEFAULT_REPO);
  const [data, setData] = useState<RepoInsightResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetchInsights(DEFAULT_REPO);
    return () => activeRequest.current?.abort();
  }, []);

  async function fetchInsights(repo: string) {
    // Cancel older requests so they cannot overwrite a newer search or unmounted UI.
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/insights?repo=${encodeURIComponent(repo)}`, { signal: controller.signal });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to load repository insights.");
      }

      const parsed = repoInsightResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("The report could not be read. Please try again.");
      setData(parsed.data);
      setRepoInput(parsed.data.repo.fullName);
    } catch (fetchError) {
      if (controller.signal.aborted) return;
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load repository insights.",
      );
      setData(null);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetchInsights(repoInput);
  }

  return (
    <main aria-busy={isLoading} className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-card-strong relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.15),transparent_62%)] lg:block" />
        <div className="relative grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm text-slate-700">
              <GitBranch className="h-4 w-4" />
              GitHub Repo Insights
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Explore a repository&apos;s activity and composition.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Paste a public GitHub repository to explore commits, languages, contributors, issues, and pull requests.
            </p>
          </div>

          <form
            className="glass-card rounded-[28px] p-4 sm:p-5"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <label className="mb-3 block text-sm font-medium text-slate-700" htmlFor="repo-input">
              Public repository
            </label>
            <div className="flex flex-col gap-3">
              <input
                id="repo-input"
                required
                maxLength={300}
                aria-describedby="repo-help"
                value={repoInput}
                onChange={(event) => setRepoInput(event.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
              >
                {isLoading ? "Analyzing repository..." : "Generate insights"}
              </button>
            </div>
            <p id="repo-help" className="mt-3 text-xs text-muted">
              Recommended demo repos: <span className="font-medium text-slate-700">vercel/next.js</span>,{" "}
              <span className="font-medium text-slate-700">facebook/react</span>,{" "}
              <span className="font-medium text-slate-700">microsoft/vscode</span>
            </p>
          </form>
        </div>
      </section>

      {error ? (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-medium">We couldn&apos;t analyze that repository.</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      ) : null}

      {!data && isLoading ? (
        <div role="status" className="mt-6 grid gap-6 lg:grid-cols-2">
          <p className="sr-only">Loading repository report.</p>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="glass-card h-44 animate-pulse rounded-[28px] bg-white/70"
            />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-muted">
            Report for {data.repo.fullName}. Sample: {data.sampling.commits} latest default-branch commits{data.sampling.commitsTruncated ? " (older commits omitted)" : ""}, {data.sampling.issues} issues from the latest 30 issue/PR records, and {data.sampling.pullRequests} PRs. Activity counts below are sample counts, not repository totals. GitHub data may be cached for 15 minutes.
          </p>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Stars"
              value={formatCompactNumber(data.repo.stars)}
              icon={<Star className="h-5 w-5" />}
            />
            <MetricCard
              label="Forks"
              value={formatCompactNumber(data.repo.forks)}
              icon={<GitFork className="h-5 w-5" />}
            />
            <MetricCard
              label="Watchers"
              value={formatCompactNumber(data.repo.watchers)}
              icon={<Activity className="h-5 w-5" />}
            />
            <MetricCard
              label="Open Issues"
              value={formatCompactNumber(data.repo.openIssues)}
              icon={<AlertCircle className="h-5 w-5" />}
            />
            <MetricCard
              label="Open PRs"
              value={formatCompactNumber(data.collaboration.openPullRequests)}
              icon={<GitPullRequest className="h-5 w-5" />}
            />
            <MetricCard
              label="Contributors Shown"
              value={formatCompactNumber(data.derived.contributorCount)}
              icon={<Users className="h-5 w-5" />}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="glass-card-strong rounded-[32px] p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <Image
                    src={data.repo.owner.avatarUrl}
                    alt={`${data.repo.owner.login} avatar`}
                    width={72}
                    height={72}
                    className="rounded-3xl"
                  />
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent)]">
                      Repository Overview
                    </p>
                    <h2 className="mt-2 break-all text-3xl font-semibold text-slate-950">
                      {data.repo.fullName}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                      {data.repo.description ?? "No repository description provided."}
                    </p>
                  </div>
                </div>
                <a
                  href={data.repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  View on GitHub
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/65">Sample Activity Score</p>
                  <p className="mt-2 text-3xl font-semibold">{data.health.score}/100</p>
                  <p className="mt-2 text-sm text-white/75">{data.health.label}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Primary Language</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {data.repo.primaryLanguage ?? "Unknown"}
                  </p>
                  <p className="mt-2 text-sm text-muted">Default branch: {data.repo.defaultBranch}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recent Momentum</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {data.derived.commitsLast30Days} commits / 30d
                  </p>
                  <p className="mt-2 text-sm text-muted">{data.derived.commitsLast90Days} commits in 90 days</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Consistency</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {data.derived.longestWeeklyStreak} week streak
                  </p>
                  <p className="mt-2 text-sm text-muted">{data.derived.averageCommitsPerWeek} avg commits per week</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 text-sm text-muted md:grid-cols-2 xl:grid-cols-4">
                <p>Created: <span className="font-medium text-slate-800">{formatFullDate(data.repo.createdAt)}</span></p>
                <p>Updated: <span className="font-medium text-slate-800">{formatFullDate(data.repo.updatedAt)}</span></p>
                <p>Last push: <span className="font-medium text-slate-800">{formatFullDate(data.repo.pushedAt)}</span></p>
                <p>Visibility: <span className="font-medium capitalize text-slate-800">{data.repo.visibility}</span></p>
              </div>
            </div>

            <SectionCard
              title="Activity Score"
              subtitle="A transparent summary of sampled activity; not a quality or security assessment."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-3xl bg-[var(--accent-soft)] px-4 py-4 text-slate-900">
                  <Scale className="h-5 w-5 text-[var(--accent-strong)]" />
                  <div>
                    <p className="text-sm font-semibold">{data.health.label}</p>
                    <p className="text-sm text-slate-700">{data.health.score} out of 100 heuristic score</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.health.reasons.map((reason) => (
                    <div key={reason} className="fine-border rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                      {reason}
                    </div>
                  ))}
                </div>
                {data.rateLimit.remaining !== null ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    GitHub API remaining this window: {data.rateLimit.remaining}
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard
              title="Commit Activity"
              subtitle="Sampled commits across twelve calendar weeks in UTC, including inactive weeks."
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.commitActivity} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="commitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe4ef" />
                    <XAxis
                      dataKey="weekStart"
                      tickFormatter={formatShortDate}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(value) => `Week of ${formatShortDate(String(value))}`}
                      formatter={(value) => [`${value} commits`, "Volume"]}
                    />
                    <Area type="monotone" dataKey="commits" stroke="#0f766e" strokeWidth={3} fill="url(#commitFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-4 text-sm text-muted">
                <summary className="cursor-pointer">View weekly commit values</summary>
                <table className="mt-3 w-full text-left">
                  <caption className="sr-only">Sampled default-branch commits by UTC week</caption>
                  <thead><tr><th scope="col">Week starting (UTC)</th><th scope="col">Commits</th></tr></thead>
                  <tbody>{data.commitActivity.map(week => <tr key={week.weekStart}><th scope="row" className="font-normal">{week.weekStart.slice(0, 10)}</th><td>{week.commits}</td></tr>)}</tbody>
                </table>
              </details>
            </SectionCard>

            <SectionCard
              title="Language Mix"
              subtitle="Byte-based breakdown from the GitHub languages endpoint."
            >
              {!data.languageBreakdown.length ? <p className="text-sm text-muted">GitHub has not reported languages for this repository.</p> : null}
              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.languageBreakdown}
                        dataKey="bytes"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {data.languageBreakdown.map((language, index) => (
                          <Cell key={language.name} fill={LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, _name, item) => [`${formatCompactNumber(Number(value))} bytes`, item.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {data.languageBreakdown.map((language, index) => (
                    <div key={language.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-slate-900">{language.name}</span>
                        </div>
                        <span className="text-sm text-muted">{language.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard
              title="Issue and PR Flow"
              subtitle="This layer shows whether the repo is actively discussing, reviewing, and shipping work."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Open Work</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCompactNumber(data.collaboration.openIssues)} issues
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {formatCompactNumber(data.collaboration.openPullRequests)} open pull requests
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">30-Day Collaboration</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCompactNumber(data.derived.issuePullRequestVelocity)} sampled work items
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {data.collaboration.issuesUpdatedLast30Days} issues and {data.collaboration.pullRequestsUpdatedLast30Days} PRs updated within 30 days
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recent Merges</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatCompactNumber(data.collaboration.mergedPullRequestsLast30Days)} merged in 30d
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Avg merge time: {formatHours(data.collaboration.averagePullRequestMergeHours)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Sample Closure Ratio</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {formatPercent(data.collaboration.issueResolutionRate)}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Issues closed / opened within 30 days in this sample. Can exceed 1; not a resolution percentage.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-3 text-sm font-medium text-slate-900">Top recent labels</p>
                <div className="flex flex-wrap gap-2">
                  {data.collaboration.topLabels.length ? (
                    data.collaboration.topLabels.map((label) => (
                      <span
                        key={label.name}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {label.name} · {label.count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">No recent labels surfaced in the sampled issues.</span>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Recent Discussions"
              subtitle="Most recently updated work items returned by GitHub."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <AlertCircle className="h-4 w-4 text-[var(--accent)]" />
                    Recent issues
                  </p>
                  <div className="space-y-3">
                    {!data.collaboration.recentIssues.length ? <p className="text-sm text-muted">No issues returned in the recent sample.</p> : null}
                    {data.collaboration.recentIssues.map((issue) => (
                      <a
                        key={issue.number}
                        href={issue.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-3xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          #{issue.number} {issue.title}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          {issue.author} • {issue.state} • updated {formatShortDate(issue.updatedAt)}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <GitPullRequest className="h-4 w-4 text-[var(--accent)]" />
                    Recent pull requests
                  </p>
                  <div className="space-y-3">
                    {!data.collaboration.recentPullRequests.length ? <p className="text-sm text-muted">No pull requests returned.</p> : null}
                    {data.collaboration.recentPullRequests.map((pullRequest) => (
                      <a
                        key={pullRequest.number}
                        href={pullRequest.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-3xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          #{pullRequest.number} {pullRequest.title}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          {pullRequest.author} • {pullRequest.mergedAt ? "merged" : pullRequest.state} • updated {formatShortDate(pullRequest.updatedAt)}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Top Contributors"
              subtitle="A small contributor summary makes collaboration scale visible right away."
            >
              <div className="space-y-3">
                {!data.contributors.length ? <p className="text-sm text-muted">No contributor records available.</p> : null}
                {data.contributors.map((contributor, index) => (
                  <a
                    key={contributor.login}
                    href={contributor.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)]">
                        #{index + 1}
                      </div>
                      <Image
                        src={contributor.avatarUrl}
                        alt={`${contributor.login} avatar`}
                        width={44}
                        height={44}
                        className="rounded-2xl"
                      />
                      <div>
                        <p className="font-medium text-slate-900">{contributor.login}</p>
                        <p className="text-sm text-muted">{contributor.contributions} default-branch commits (all time)</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </a>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Recent Activity"
              subtitle="Public GitHub events add a qualitative feed on top of the quantitative charts."
            >
              <div className="space-y-3">
                {!data.recentActivity.length ? <p className="text-sm text-muted">No recent public events available.</p> : null}
                {data.recentActivity.map((event) => (
                  <div key={event.id} className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{event.summary}</p>
                        <p className="mt-1 text-sm text-muted">
                          {event.actor} • {event.type.replace(/Event$/, "")}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-xs uppercase tracking-[0.18em] text-slate-400">
                        {formatShortDate(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="glass-card rounded-[24px] p-5">
              <div className="mb-3 flex items-center gap-3">
                <GitCommitHorizontal className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-slate-900">Why this metric matters</h3>
              </div>
              <p className="text-sm leading-6 text-muted">
                Commit frequency shows observed development activity. A quiet repository can still be useful and well maintained; interpret these samples in context.
              </p>
            </div>
            <div className="glass-card rounded-[24px] p-5">
              <div className="mb-3 flex items-center gap-3">
                <Flame className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-slate-900">Sampling limits</h3>
              </div>
              <p className="text-sm leading-6 text-muted">
                Busy repositories can have more activity than the report samples. Merge times describe only PRs merged within 30 days in the returned sample.
              </p>
            </div>
            <div className="glass-card rounded-[24px] p-5">
              <div className="mb-3 flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-slate-900">Public data</h3>
              </div>
              <p className="text-sm leading-6 text-muted">
                Reports use public GitHub data. No sign-in is required, and this app does not store searches in a database.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
