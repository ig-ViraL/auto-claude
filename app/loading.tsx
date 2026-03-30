import { SkeletonTable } from "@/components/SkeletonTable";

/**
 * Next.js loading.tsx — shown instantly (from the static shell) while
 * the page's async data fetching completes. This is the route-level
 * Suspense fallback.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse" />
        <div className="mt-1 h-4 w-72 rounded bg-slate-100 animate-pulse" />
      </div>
      <SkeletonTable rows={20} />
    </div>
  );
}
