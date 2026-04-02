export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function PaperCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-20 w-28 shrink-0 animate-pulse rounded bg-gray-200" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <SkeletonLine className="h-4 w-3/4" />
          <SkeletonLine className="h-3 w-1/2" />
          <div className="mt-2 flex gap-2">
            <SkeletonLine className="h-5 w-16 rounded-full" />
            <SkeletonLine className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopicCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between">
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonLine className="h-2 w-full rounded-full" />
        <SkeletonLine className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function FigureCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="aspect-video w-full animate-pulse rounded bg-gray-200" />
      <SkeletonLine className="mt-2 h-3 w-full" />
      <SkeletonLine className="mt-1 h-3 w-2/3" />
    </div>
  );
}
