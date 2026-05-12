// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ type = 'gray', children }) {
  const map = { green:'badge-green', amber:'badge-amber', red:'badge-red', blue:'badge-blue', gray:'badge-gray' };
  return <span className={map[type] || map.gray}>{children}</span>;
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cfg = {
    active:       { type:'green', label:'Active' },
    low_stock:    { type:'amber', label:'Low Stock' },
    out_of_stock: { type:'red',   label:'Out of Stock' },
    inactive:     { type:'gray',  label:'Inactive' },
    discontinued: { type:'gray',  label:'Discontinued' },
    completed:    { type:'green', label:'Completed' },
    pending:      { type:'amber', label:'Pending' },
    refunded:     { type:'blue',  label:'Refunded' },
    cancelled:    { type:'red',   label:'Cancelled' },
    retail:       { type:'blue',  label:'Retail' },
    wholesale:    { type:'amber', label:'Wholesale' },
  };
  const { type, label } = cfg[status] || { type:'gray', label: status };
  return <Badge type={type}>{label}</Badge>;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const sz = { sm:'w-4 h-4', md:'w-6 h-6', lg:'w-10 h-10' }[size];
  return <div className={`${sz} border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin`} />;
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function Empty({ icon = '📭', title = 'No data', subtitle = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-gray-800 font-medium">{title}</p>
      {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ title, value, sub, icon, color = 'amber' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    blue:  'bg-blue-50 text-blue-600',
    red:   'bg-red-50 text-red-600',
    purple:'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${colors[color]}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm:'max-w-md', md:'max-w-xl', lg:'max-w-3xl', xl:'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
export function Confirm({ open, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : null} Confirm
        </button>
      </div>
    </Modal>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, data, loading, onRowClick }) {
  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!data?.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>{columns.map(c => <th key={c.key} className="th">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row, i) => (
            <tr key={row._id || i}
              className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(row)}>
              {columns.map(c => (
                <td key={c.key} className="td">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, limit, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
      <span>Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}</span>
      <div className="flex gap-1">
        <button className="btn-ghost py-1 px-2 text-xs" disabled={page===1} onClick={()=>onChange(page-1)}>‹ Prev</button>
        {[...Array(Math.min(pages,5))].map((_,i) => {
          const p = i+1;
          return <button key={p} onClick={()=>onChange(p)} className={`px-3 py-1 rounded text-xs font-medium ${p===page?'bg-amber-500 text-white':'hover:bg-gray-100'}`}>{p}</button>;
        })}
        <button className="btn-ghost py-1 px-2 text-xs" disabled={page===pages} onClick={()=>onChange(page+1)}>Next ›</button>
      </div>
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Form Field ────────────────────────────────────────────────────────────────
export function Field({ label, error, children }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Role Gate ─────────────────────────────────────────────────────────────────
export function RoleGate({ roles, children, fallback = null }) {
  const user = JSON.parse(localStorage.getItem('sp_user') || 'null');
  if (!roles.includes(user?.role)) return fallback;
  return children;
}
