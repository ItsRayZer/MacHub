/**
 * DataTable — Smart table component with pass/fail row coloring.
 * Supports empty state, scrollable overflow.
 */

export default function DataTable({ headers, rows = [], passField, failValues }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3>No Data Available</h3>
        <p>No records found for this section. Check back later or try refreshing.</p>
      </div>
    );
  }

  // Use provided headers or derive from first row keys
  const displayHeaders = headers?.length ? headers : Object.keys(rows[0] || {}).filter(k => !k.startsWith('_'));

  return (
    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
      <table className="data-table">
        <thead>
          <tr>
            {displayHeaders.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const passValue = passField ? row[passField] : null;
            const isFail = failValues && passValue && failValues.some(f =>
              String(passValue).toLowerCase().includes(f.toLowerCase())
            );
            const isPass = passField && passValue && !isFail;

            return (
              <tr
                key={ri}
                className={isPass ? 'row-pass' : isFail ? 'row-fail' : ''}
              >
                {displayHeaders.map(h => (
                  <td key={h}>{row[h] ?? '—'}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
