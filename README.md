# GitHub Repo Insights

A polished GitHub repository analytics dashboard built with Next.js, TypeScript, Tailwind CSS, Zod, and Recharts.

## Why This Project Exists

This project is designed as an internship-ready portfolio piece. It demonstrates how to:

- integrate with a real external API
- validate and transform raw API data into product-friendly insights
- design a dashboard that explains engineering activity clearly
- structure a full-stack web app with a lightweight backend-for-frontend layer

## MVP Scope

The current MVP focuses on public repositories and does not require GitHub OAuth.

It supports:

- repository input as `owner/repo` or full GitHub URL
- repository metadata summary cards
- language breakdown visualization
- recent weekly commit activity chart
- top contributor summaries
- recent public activity feed
- issue and pull request flow analysis
- lightweight repo health heuristic
- loading, error, and rate-limit states
- responsive recruiter-friendly UI

## Tech Stack

- `Next.js 16` with the App Router
- `TypeScript` for safer API and UI code
- `Tailwind CSS 4` for styling
- `Recharts` for charts
- `Zod` for runtime validation
- GitHub REST API for public repository data

## Architecture

The app uses a simple backend-for-frontend pattern:

1. The user submits a repository name in the client UI.
2. The Next.js route handler at `/api/insights` fetches public GitHub API data server-side.
3. The server validates and transforms the raw responses into one clean dashboard payload.
4. The frontend renders summary cards, charts, and recent activity from that single app-specific contract.

Why this is a good MVP decision:

- the browser stays decoupled from GitHub API details
- adding `GITHUB_TOKEN` later will not require a frontend rewrite
- validation and data shaping stay centralized
- the UI only consumes product-ready data

## GitHub API Sources

The dashboard currently combines:

- repository metadata
- languages
- contributors
- recent commits
- recent public repository events
- recent issues
- recent pull requests

## Local Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional Environment Variables

Create a local `.env.local` file if you want higher GitHub API rate limits:

```bash
GITHUB_TOKEN=your_personal_access_token
```

For the MVP, a fine-grained token is not required if you only analyze public repositories occasionally, but it is helpful during repeated demos and development.

## Deployment Notes

This app is a good fit for Vercel because it is a standard Next.js application with server-side route handlers.

Recommended production setup:

1. Import the GitHub repository into Vercel.
2. Add `GITHUB_TOKEN` in the Vercel project environment variables.
3. Keep the app public and use the token only for server-side GitHub API requests.
4. Redeploy after environment variables are added.

Why add the token before shipping:

- public unauthenticated GitHub API limits are easy to hit during recruiter demos
- authenticated server-side requests make the deployed app much more reliable
- the frontend does not need to change because the token is already read on the server

## Pre-Deployment Checklist

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- set `GITHUB_TOKEN` for production
- verify a few demo repositories still load correctly
- add screenshots or a short demo GIF for the GitHub README
- add the deployed URL to this README once live

## Verification

Useful commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Good Repos To Demo

- `vercel/next.js`
- `facebook/react`
- `microsoft/vscode`
- `tailwindlabs/tailwindcss`

## Next Steps

Strong follow-up features after the MVP:

- compare two repositories side by side
- save recent searches locally
- export a markdown summary report
- add caching for repeat lookups
- introduce repo health scoring details and trend comparisons
