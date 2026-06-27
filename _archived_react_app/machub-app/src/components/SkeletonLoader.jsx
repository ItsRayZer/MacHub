/**
 * SkeletonLoader — Animated shimmer placeholder.
 * Never blocks the page; only appears in data containers.
 */

/** A single skeleton rectangle */
export function SkeletonRect({ width = '100%', height = 20, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 8, ...style }}
    />
  );
}

/** Skeleton for a table — N rows with M columns */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '10px 16px' }}>
                <SkeletonRect height={14} width="80%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ padding: '14px 16px' }}>
                  <SkeletonRect height={16} width={`${60 + Math.random() * 40}%`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton for cards grid */
export function SkeletonCards({ count = 6 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '24px' }}>
          <SkeletonRect height={40} width={40} style={{ borderRadius: 10, marginBottom: 16 }} />
          <SkeletonRect height={14} width="60%" style={{ marginBottom: 8 }} />
          <SkeletonRect height={32} width="40%" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a profile page */
export function SkeletonProfile() {
  return (
    <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
      <SkeletonRect width={120} height={120} style={{ borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <SkeletonRect height={28} width="50%" style={{ marginBottom: 12 }} />
        <SkeletonRect height={16} width="35%" style={{ marginBottom: 24 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <SkeletonRect height={14} width="30%" />
            <SkeletonRect height={14} width="50%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline spinner for refresh indicators */
export function Spinner({ size = 20, color = 'var(--accent)' }) {
  return (
    <svg
      className="spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Default multiline text skeleton loader helper.
 */
export default function SkeletonLoader({ lines = 3, height = 16, width = '100%', style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonRect
          key={i}
          height={height}
          width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}
