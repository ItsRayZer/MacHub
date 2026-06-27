/**
 * PageHeader — Reusable page title bar with refresh button.
 * Shows a subtle "refreshing" indicator instead of blocking spinners.
 */
import { Spinner } from './SkeletonLoader';

export default function PageHeader({ title, subtitle, onRefresh, isRefreshing, lastUpdated }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
        {lastUpdated && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Last synced: {new Date(lastUpdated).toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {onRefresh && (
        <button
          className="btn-icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
          style={{ gap: '6px', padding: '10px', display: 'flex', alignItems: 'center' }}
        >
          {isRefreshing
            ? <Spinner size={18} />
            : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          }
        </button>
      )}
    </div>
  );
}
