import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to:'/dashboard',  icon:'📊', label:'Dashboard'    },
  { to:'/pos',        icon:'🛒', label:'POS Terminal'  },
  { to:'/products',   icon:'💍', label:'Products'      },
  { to:'/customers',  icon:'👥', label:'Customers'     },
  { to:'/sales',      icon:'🧾', label:'Sales'         },
  { to:'/reports',    icon:'📈', label:'Reports'       },
  { to:'/ai',         icon:'🤖', label:'AI Assistant'  },
  { to:'/settings',   icon:'⚙️',  label:'Settings'      },
];

const ROLE_COLOR = {
  owner:      'bg-amber-500',
  manager:    'bg-blue-500',
  cashier:    'bg-green-500',
  wholesaler: 'bg-purple-500',
  viewer:     'bg-gray-500',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-lg">💎</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Silver Palace</p>
            <p className="text-slate-500 text-xs">Jewelry Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto no-scrollbar">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 py-2 mt-1">Menu</p>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => isActive ? 'sidebar-active' : 'sidebar-item'}>
            <span className="text-base">{icon}</span>
            <span>{label}</span>
            {to === '/ai' && (
              <span className="ml-auto text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-medium">AI</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <div className={`w-8 h-8 ${ROLE_COLOR[user?.role] || 'bg-gray-500'} rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-500 text-xs capitalize">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors text-lg" title="Sign out">⏏</button>
        </div>
      </div>
    </aside>
  );
}