import { SkeletonDetail } from "@/components/SkeletonTable";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
      <SkeletonDetail />
    </div>
  );
}
