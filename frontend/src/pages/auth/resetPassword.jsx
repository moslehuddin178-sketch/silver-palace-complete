import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui';

export default function ResetPassword() {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { login }    = useAuth();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [showPass, setShowPass]     = useState(false);

  useEffect(() => {
    authAPI.verifyResetToken(token)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleReset = async () => {
    if (!password)           return toast.error('Enter a new password');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword(token, { password });
      login(data.user, data.token);
      toast.success('Password reset! Welcome back.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-2xl">💎</div>
          <div>
            <p className="text-white font-bold">Silver Palace</p>
            <p className="text-slate-500 text-sm">Set new password</p>
          </div>
        </div>

        {!tokenValid ? (
          <div className="bg-slate-800 rounded-2xl p-8 text-center border border-white/10">
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-white font-bold text-xl mb-2">Link expired</h2>
            <p className="text-slate-400 text-sm mb-6">
              This password reset link is invalid or has expired. Reset links are only valid for 30 minutes.
            </p>
            <Link to="/forgot-password"
              className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-center text-sm transition-colors">
              Request a new link
            </Link>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10">
            <h2 className="text-white font-bold text-xl mb-1">Set new password</h2>
            <p className="text-slate-400 text-sm mb-6">Choose a strong password for your account.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">New Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} autoFocus
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-700 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                {/* Strength indicator */}
                {password && (
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length >= i * 3
                          ? password.length >= 10 ? 'bg-green-500' : password.length >= 7 ? 'bg-amber-500' : 'bg-red-500'
                          : 'bg-slate-600'
                      }`} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Confirm Password</label>
                <input type={showPass ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  placeholder="Repeat password"
                  className={`w-full bg-slate-700 border text-white rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    confirm && confirm !== password ? 'border-red-500' : 'border-white/10'
                  }`} />
                {confirm && confirm !== password && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              <button onClick={handleReset} disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Spinner size="sm" /> : null}
                {loading ? 'Resetting…' : 'Reset Password'}
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