import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { productAPI, saleAPI, silverAPI } from '../../api';
import { StatCard, Spinner, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import WeatherWidget from '../../components/ui/weatherWidget';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [daily, setDaily]         = useState(null);
  const [silver, setSilver]       = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      productAPI.analytics(),
      saleAPI.dailyReport(),
      silverAPI.getActive(),
    ]).then(([a, d, s]) => {
      setAnalytics(a.data.data);
      setDaily(d.data.data);
      setSilver(s.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;

  const totalRevenue = daily?.totals?.totalRevenue || 0;
  const totalSales   = daily?.totals?.totalSales   || 0;
  const totalGrams   = daily?.totals?.totalGrams   || 0;
  const overview     = analytics?.overview || {};
  const lowStock     = analytics?.lowStock || [];
  const topSellers   = analytics?.topSellers || [];
  const byCategory   = analytics?.byCategory || [];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-gray-400 text-sm mt-0.5">{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <button onClick={() => navigate('/pos')} className="btn-primary text-sm">
          🛒 Open POS Terminal
        </button>
      </div>

      {/* Silver price banner */}
      {silver && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="font-bold text-lg">${silver.gramPrice?.toFixed(2)}/gram</p>
              <p className="text-amber-100 text-xs">Current silver price · {silver.source}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-100 text-xs">Total inventory value</p>
            <p className="font-bold text-lg">{overview.totalStockGrams?.toFixed(0)}g in stock</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Revenue"  value={`$${totalRevenue.toFixed(2)}`}  sub={`${totalSales} sales today`}     icon="💰" color="green"  />
        <StatCard title="Grams Sold Today" value={`${totalGrams?.toFixed(1)}g`}   sub="total weight sold"               icon="⚖️"  color="amber"  />
        <StatCard title="Total Products"   value={overview.totalProducts || 0}    sub={`${overview.lowStockCount || 0} low stock`} icon="💍" color="blue"   />
        <StatCard title="Out of Stock"     value={overview.outOfStockCount || 0}  sub="items need restocking"           icon="⚠️"  color="red"    />
      </div>

     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <WeatherWidget />
     </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} margin={{ left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="_id" tick={{ fontSize:11 }} />
              <YAxis tick={{ fontSize:11 }} />
              <Tooltip formatter={(v) => [v, 'Items']} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top sellers */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Sellers</h3>
          {topSellers.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {topSellers.slice(0,6).map((p, i) => (
                <div key={p._id} className="flex items-center gap-3">
                  <span className="w-5 h-5 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{p.totalSold} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today breakdown & Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's sales by type */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Today's Sales Breakdown</h3>
          {daily?.byType?.length ? (
            <div className="space-y-3">
              {daily.byType.map(t => (
                <div key={t._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <StatusBadge status={t._id} />
                    <p className="text-xs text-gray-400 mt-1">{t.count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${t.totalAmount?.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{t.totalWeight?.toFixed(1)}g sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-8">No sales today yet</p>}
        </div>

        {/* Low stock alerts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Low Stock Alerts</h3>
            {lowStock.length > 0 && <span className="badge-red">{lowStock.length} items</span>}
          </div>
          {lowStock.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-400 text-sm">All stock levels healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0,6).map(p => (
                <div key={p._id} onClick={() => navigate(`/products/${p._id}`)}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.sku} · {p.warehouse}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-bold text-sm">{p.stockQty} left</p>
                    <p className="text-xs text-gray-400">min: {p.minimumStock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
