# Security

To report a vulnerability, use GitHub private vulnerability reporting if enabled on this repository. Otherwise contact the maintainer through their public GitHub profile before posting exploitable details in an issue. Private reporting must be enabled by the repository owner in Settings > Security.

The app accepts only public repositories on github.com. It has no user authentication, database, uploads, webhooks, or admin interface. Its optional `GITHUB_TOKEN` remains on the server. Use a dedicated token restricted to public read access; never use an organization or administrator token. Rotate any credential that has been exposed, even after removing it from a file.

GitHub requests use a fixed API host, strict repository identifiers, at most three same-origin redirects, a 12-second timeout for each request chain, and runtime response validation. Credentials are never forwarded to a different origin. Private metadata is rejected before detail requests. The application returns sanitized failures and does not log GitHub payloads or token values.

The API allows up to four concurrent reports and 30 attempts per minute **per process**. This is a resource guard, not distributed abuse protection. For a public deployment, configure host-level request limits and monitor GitHub quota and hosting spend. No client IP is collected by the app for this guard.

GitHub responses may be cached by Next.js for 15 minutes, including public account names and avatars. There is no application database or analytics SDK. Hosting providers may keep access logs and the GitHub API receives server requests. Browser avatars and server image optimization contact GitHub's avatar service.

`pnpm scan:secrets` scans the working tree, reachable Git history, and generated text assets for selected common secret formats. It reports locations without values. It can miss arbitrary passwords and nonstandard credentials; it is not a security certification. CI also audits the dependency lockfile. Re-run these checks before releases.

CI additionally runs checksum-verified Gitleaks 8.30.1 against history and the working directory. Its configuration excludes dependency folders, local verification copies, and four Next.js-generated server key files. Next.js preview/action encryption keys are expected private build artifacts, not GitHub tokens. They were verified absent from `.next/static` during review; do not serve `.next/server` or cache manifests as public static assets. All other build text assets remain in scope.
