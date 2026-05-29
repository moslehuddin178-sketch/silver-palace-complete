import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../api';
import { Spinner } from '../../components/ui';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return toast.error('Enter your email');
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-2xl">💎</div>
          <div>
            <p className="text-white font-bold">Silver Palace</p>
            <p className="text-slate-500 text-sm">Password recovery</p>
          </div>
        </div>

        {sent ? (
          <div className="bg-slate-800 rounded-2xl p-8 text-center border border-white/10">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm mb-6">
              We sent a password reset link to <span className="text-amber-400 font-medium">{email}</span>.
              The link expires in 30 minutes.
            </p>
            <p className="text-slate-500 text-xs mb-6">
              Didn't receive it? Check your spam folder or try again.
            </p>
            <div className="space-y-2">
              <button onClick={() => setSent(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors">
                Try a different email
              </button>
              <Link to="/login" className="block w-full text-center text-amber-400 hover:text-amber-300 text-sm py-2 transition-colors">
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10">
            <h2 className="text-white font-bold text-xl mb-1">Forgot password?</h2>
            <p className="text-slate-400 text-sm mb-6">
              Enter your email and we'll send you a reset link.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="you@company.com" autoFocus
                  className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Spinner size="sm" /> : null}
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <Link to="/login" className="block text-center text-slate-400 hover:text-white text-sm transition-colors">
                ← Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}