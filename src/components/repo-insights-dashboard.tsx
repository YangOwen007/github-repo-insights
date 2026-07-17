"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Flame,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
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
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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

  useEffect(() => {
    void fetchInsights(DEFAULT_REPO);
  }, []);

  async function fetchInsights(repo: string) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/insights?repo=${encodeURIComponent(repo)}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to load repository insights.");
      }

      const parsed = repoInsightResponseSchema.parse(body);
      setData(parsed);
      setRepoInput(repo);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load repository insights.",
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetchInsights(repoInput);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-card-strong relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.15),transparent_62%)] lg:block" />
        <div className="relative grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm text-slate-700">
              <GitBranch className="h-4 w-4" />
              Internship-ready GitHub analytics project
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Understand a repository’s engineering story in one polished report.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Paste a public GitHub repository and turn raw activity data into a clear dashboard of momentum, composition, contributors, and health signals.
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
            <p className="mt-3 text-xs text-muted">
              Recommended demo repos: <span className="font-medium text-slate-700">vercel/next.js</span>,{" "}
              <span className="font-medium text-slate-700">facebook/react</span>,{" "}
              <span className="font-medium text-slate-700">microsoft/vscode</span>
            </p>
          </form>
        </div>
      </section>

      {error ? (
        <div className="mt-6 flex items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-medium">We couldn&apos;t analyze that repository.</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      ) : null}

      {!data && isLoading ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              label="Active Contributors"
              value={formatCompactNumber(data.derived.contributorCount)}
              icon={<Users className="h-5 w-5" />}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="glass-card-strong rounded-[32px] p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
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
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">
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
                  <p className="text-xs uppercase tracking-[0.22em] text-white/65">Health Signal</p>
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
              title="Health Heuristic"
              subtitle="A lightweight interview-friendly score built from activity, contributors, and maintenance signals."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-3xl bg-[var(--accent-soft)] px-4 py-4 text-slate-900">
                  <Scale className="h-5 w-5 text-[var(--accent-strong)]" />
                  <div>
                    <p className="text-sm font-semibold">{data.health.label} repo health</p>
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
              subtitle="Recent weekly commit volume helps recruiters see whether a project is actively moving."
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
            </SectionCard>

            <SectionCard
              title="Language Mix"
              subtitle="Byte-based breakdown from the GitHub languages endpoint."
            >
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
                  {data.languageBreakdown.slice(0, 6).map((language, index) => (
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

          <section className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Top Contributors"
              subtitle="A small contributor summary makes collaboration scale visible right away."
            >
              <div className="space-y-3">
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
                        <p className="text-sm text-muted">{contributor.contributions} recent contributions</p>
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
                Commit frequency tells a stronger story than raw star count because it shows whether a project is still being worked on.
              </p>
            </div>
            <div className="glass-card rounded-[24px] p-5">
              <div className="mb-3 flex items-center gap-3">
                <Flame className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-slate-900">MVP architecture choice</h3>
              </div>
              <p className="text-sm leading-6 text-muted">
                The app uses a Next.js route handler as a backend-for-frontend so GitHub tokens, validation, and transformations stay server-side.
              </p>
            </div>
            <div className="glass-card rounded-[24px] p-5">
              <div className="mb-3 flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-slate-900">Future-ready extension path</h3>
              </div>
              <p className="text-sm leading-6 text-muted">
                You can add authenticated rate-limit upgrades, repo comparison, or cached historical reports later without reworking the UI contract.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
