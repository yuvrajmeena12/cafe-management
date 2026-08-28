export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden animate-pulse p-4 space-y-3">
          <div className="h-44 bg-sage-100/70 rounded-xl animate-shimmer" />
          <div className="flex justify-between items-center pt-2">
            <div className="h-5 bg-sage-100/80 rounded w-2/3 animate-shimmer" />
            <div className="h-5 bg-sage-100/80 rounded w-16 animate-shimmer" />
          </div>
          <div className="h-4 bg-sage-50 rounded w-full animate-shimmer" />
          <div className="h-4 bg-sage-50 rounded w-4/5 animate-shimmer" />
          <div className="h-10 bg-sage-100/60 rounded-xl w-full mt-4 animate-shimmer" />
        </div>
      ))}
    </>
  )
}

export function SkeletonOrder({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse flex justify-between items-center">
          <div className="space-y-2 w-1/2">
            <div className="h-4 bg-sage-100 rounded w-3/4 animate-shimmer" />
            <div className="h-3 bg-sage-50 rounded w-1/2 animate-shimmer" />
          </div>
          <div className="space-y-2 w-20 text-right">
            <div className="h-4 bg-sage-100 rounded w-full animate-shimmer ml-auto" />
            <div className="h-4 bg-sage-50 rounded-full w-16 ml-auto animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse space-y-2">
          <div className="w-6 h-6 bg-sage-100 rounded-lg animate-shimmer" />
          <div className="h-3 bg-sage-50 rounded w-2/3 animate-shimmer" />
          <div className="h-6 bg-sage-100 rounded w-1/2 animate-shimmer" />
        </div>
      ))}
    </div>
  )
}
