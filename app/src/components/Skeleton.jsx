// Simple shimmer skeletons. Usage: <Skeleton w="60%" h={14} /> or <SkeletonCard />
export function Skeleton({ w = '100%', h = 12, r = 7, style }) {
  return <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card skel-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton w={70} h={18} r={999} />
        <Skeleton w={28} h={12} />
      </div>
      <Skeleton w="80%" h={16} style={{ marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={`${90 - i * 12}%`} h={11} style={{ marginBottom: 7 }} />
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6, lines = 3 }) {
  return (
    <div className="hist-grid">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}
    </div>
  )
}
