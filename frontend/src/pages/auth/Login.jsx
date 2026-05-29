import { useState } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [tab,  setTab]  = useState('signin');
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'cashier' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async () => {
    setLoading(true);
    try {
      const payload = tab === 'signin'
        ? { email: form.email, password: form.password }
        : form;
      const fn = tab === 'signin' ? authAPI.signin : authAPI.signup;
      const { data } = await fn(payload);
      login(data.user, data.token);
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-slate-900 border-r border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-2xl">💎</div>
          <div>
            <p className="text-white font-bold">Silver Palace</p>
            <p className="text-slate-500 text-sm">Jewelry Management System</p>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Complete control for your<br />
            <span className="text-amber-400">silver jewelry</span> business
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Manage 50,000+ products, track inventory in grams, run your POS terminal, handle wholesale accounts, and generate professional invoices — all in one place.
          </p>
          <div className="flex flex-wrap gap-2 mt-8">
            {['POS Terminal','QR Labels','Wholesale','Retail','Live Silver Price','Reports'].map(f => (
              <span key={f} className="bg-white/5 border border-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-full">{f}</span>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} Silver Palace · Enterprise Edition</p>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-[440px] flex items-center justify-center p-8 bg-slate-800">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-white text-2xl font-bold">{tab === 'signin' ? 'Welcome back' : 'Create account'}</h2>
            <p className="text-slate-400 text-sm mt-1">{tab === 'signin' ? 'Sign in to your account' : 'Fill in your details below'}</p>

          </div>

          {/* Tabs */}
          <div className="flex bg-slate-700/50 rounded-lg p-1 mb-6">
            {[['signin','Sign In'],['signup','Sign Up']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab===key ? 'bg-white text-gray-900 shadow' : 'text-slate-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input name="name" value={form.name} onChange={handle} placeholder="Ali Hassan"
                  className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
              <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@company.com"
                className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
           <div>
  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>

  {tab === 'signin' && (
    <div className="text-right mb-2">
      <Link to="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
        Forgot password?
      </Link>
    </div>
  )}

  <input name="password" type="password" value={form.password} onChange={handle} placeholder="Min 6 characters"
    className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
</div>
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Role</label>
                <select name="role" value={form.role} onChange={handle}
                  className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {['owner','manager','cashier','wholesaler','viewer'].map(r => (
                    <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase()+r.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={submit} disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {loading ? <Spinner size="sm" /> : null}
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
