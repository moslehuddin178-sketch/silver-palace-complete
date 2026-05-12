import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { silverAPI } from '../../api';

const TITLES = {
  '/dashboard':'/dashboard',
  '/pos':'POS Terminal',
  '/products':'Products',
  '/customers':'Customers',
  '/sales':'Sales',
  '/reports':'Reports',
  '/settings':'Settings',
};

export default function Topbar() {
  const location = useLocation();
  const [silverPrice, setSilverPrice] = useState(null);
  const title = Object.entries(TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] || 'Dashboard';

  useEffect(() => {
    silverAPI.getActive().then(r => setSilverPrice(r.data.data?.gramPrice || null)).catch(() => {});
  }, []);

  return (
    <header className="h-14 bg-white border-b flex items-center px-6 gap-4 sticky top-0 z-20">
      <h2 className="text-sm font-semibold text-gray-700 flex-1">
        {location.pathname === '/dashboard' ? '📊 Dashboard' : `💍 ${title}`}
      </h2>

      {/* Silver price ticker */}
      {silverPrice && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <span className="text-amber-500 text-sm">🪙</span>
          <span className="text-xs font-semibold text-amber-700">Silver: ${silverPrice}/g</span>
          <span className="text-xs text-amber-500">live</span>
        </div>
      )}

      {/* Date */}
      <div className="text-xs text-gray-400 font-mono">
        {new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
      </div>
    </header>
  );
}
