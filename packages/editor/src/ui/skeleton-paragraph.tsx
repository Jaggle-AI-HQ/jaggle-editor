import { Skeleton } from "./skeleton";

export default function SkeletonParagraph() {
  return (
    <div className="flex flex-col gap-y-2">
      <Skeleton className="w-1/4 h-8 mb-2" />
      <Skeleton className="w-full h-6" />
      <Skeleton className="w-full h-6" />
      <Skeleton className="w-1/3 h-6 mb-4" />

      <Skeleton className="w-1/5 h-8 mb-2" />
      <Skeleton className="w-full h-6" />
      <Skeleton className="w-1/2 h-6" />
    </div>
  );
}
