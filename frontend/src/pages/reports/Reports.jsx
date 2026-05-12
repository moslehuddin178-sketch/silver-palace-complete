import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import { saleAPI, productAPI, silverAPI } from '../../api';
import { StatCard, Spinner } from '../../components/ui';

const COLORS = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#06b6d4','#f97316'];

export default function Reports() {
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10));
  const [daily, setDaily]       = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [silver, setSilver]     = useState(null);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      saleAPI.dailyReport({ date }),
      productAPI.analytics(),
      silverAPI.getActive(),
      silverAPI.getHistory(),
    ]).then(([d, a, s, h]) => {
      setDaily(d.data.data);
      setAnalytics(a.data.data);
      setSilver(s.data.data);
      setHistory(h.data.data?.slice(0,10) || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;

  const totals  = daily?.totals || {};
  const overview = analytics?.overview || {};
  const byCategory = analytics?.byCategory || [];
  const byPurity   = analytics?.byPurity   || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">Business intelligence dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500">Date:</label>
          <input type="date" className="input w-40" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
      </div>

      {/* Daily KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Daily Revenue"  value={`$${(totals.totalRevenue||0).toFixed(2)}`}  icon="💰" color="green" />
        <StatCard title="Daily Sales"    value={totals.totalSales || 0}                      icon="🧾" color="blue"  />
        <StatCard title="Grams Sold"     value={`${(totals.totalGrams||0).toFixed(1)}g`}    icon="⚖️"  color="amber" />
        <StatCard title="Silver Price"   value={`$${silver?.gramPrice || '—'}/g`}           icon="🪙" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily breakdown by type */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Breakdown by Sale Type</h3>
          {daily?.byType?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily.byType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize:12, textTransform:'capitalize' }} />
                <YAxis tick={{ fontSize:12 }} />
                <Tooltip formatter={v=>[`$${v.toFixed(2)}`,'Revenue']} />
                <Bar dataKey="totalAmount" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-16 text-sm">No sales on this date</p>}
        </div>

        {/* Payment methods */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Payments by Method</h3>
          {daily?.byPayment?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={daily.byPayment} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={80} label={({ _id, total }) => `${_id}: $${total?.toFixed(0)}`}>
                  {daily.byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v=>[`$${v.toFixed(2)}`]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-16 text-sm">No sales data</p>}
        </div>

        {/* Inventory by category */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} layout="vertical" margin={{ left:10 }}>
              <XAxis type="number" tick={{ fontSize:11 }} />
              <YAxis type="category" dataKey="_id" tick={{ fontSize:11 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0,4,4,0]} label={{ position:'right', fontSize:11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory by purity */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Products by Silver Purity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byPurity} dataKey="count" nameKey="_id" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                {byPurity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Products"  value={overview.totalProducts || 0}                          icon="💍" color="blue"   />
        <StatCard title="Total Stock (g)" value={`${(overview.totalStockGrams||0).toFixed(0)}g`}      icon="⚖️"  color="amber" sub="all products combined" />
        <StatCard title="Low Stock Items" value={overview.lowStockCount || 0}                          icon="⚠️"  color="amber" />
        <StatCard title="Out of Stock"    value={overview.outOfStockCount || 0}                        icon="🚫" color="red"   />
      </div>

      {/* Silver price history */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Silver Price History (last 10 updates)</h3>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="th">Date</th><th className="th">Price/g</th><th className="th">Currency</th><th className="th">Source</th><th className="th">Set by</th><th className="th">Notes</th></tr></thead>
              <tbody className="divide-y">
                {history.map(h => (
                  <tr key={h._id} className="hover:bg-gray-50">
                    <td className="td text-xs text-gray-400">{new Date(h.createdAt).toLocaleString()}</td>
                    <td className="td font-bold text-amber-600 font-mono">${h.gramPrice?.toFixed(2)}</td>
                    <td className="td">{h.currency}</td>
                    <td className="td capitalize">{h.source}</td>
                    <td className="td">{h.setBy?.name || '—'}</td>
                    <td className="td text-gray-400">{h.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-gray-400 text-sm text-center py-8">No price history</p>}
      </div>

      {/* Cashier breakdown */}
      {daily?.byCashier?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Today's Sales by Cashier</h3>
          <div className="space-y-2">
            {daily.byCashier.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {c.cashierInfo?.[0]?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{c.cashierInfo?.[0]?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{c.count} transactions</p>
                  </div>
                </div>
                <p className="font-bold text-green-600">${c.total?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
