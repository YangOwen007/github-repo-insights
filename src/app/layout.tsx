import type { Metadata } from "next";
import "./globals.css";

// This metadata controls the browser tab title and the social preview basics for the app.
export const metadata: Metadata = {
  title: "GitHub Repo Insights",
  description:
    "Explore public GitHub repository languages, contributors, and sampled commit, issue, and pull request activity.",
};

// This root layout wraps every page so shared styling and metadata only need to be defined once.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
