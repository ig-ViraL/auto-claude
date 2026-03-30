import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // Enable Cache Components (Next.js 16) — makes caching fully opt-in via 'use cache'.
  // All routes run dynamically by default; cache explicitly where needed.
  cacheComponents: true,

  // React Compiler (stable in Next.js 16) handles memoization automatically.
  // No manual React.memo or useMemo needed in most cases.
  reactCompiler: true,
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
