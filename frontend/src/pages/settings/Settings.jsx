import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { silverAPI, authAPI } from '../../api';
import { Field, Spinner, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function Settings() {
  const { user, can } = useAuth();
  const [silver, setSilver]   = useState(null);
  const [priceForm, setPriceForm] = useState({ gramPrice:'', notes:'' });
  const [saving, setSaving]   = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    silverAPI.getActive().then(r => { setSilver(r.data.data); setPriceForm(f => ({...f, gramPrice: r.data.data?.gramPrice || ''})); });
    silverAPI.getHistory().then(r => setHistory(r.data.data || []));
  }, []);

  const updatePrice = async () => {
    if (!can('owner','manager')) return toast.error('Permission denied');
    setSaving(true);
    try {
      await silverAPI.setPrice(priceForm);
      toast.success('Silver price updated!');
      silverAPI.getHistory().then(r => setHistory(r.data.data || []));
      silverAPI.getActive().then(r => setSilver(r.data.data));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Shop configuration and silver price management" />

      {/* Current silver price */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl">🪙</div>
          <div>
            <h2 className="font-semibold text-gray-900">Silver Price Management</h2>
            <p className="text-gray-400 text-sm">Update the live silver gram price used for all product calculations</p>
          </div>
        </div>

        {silver && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-600 uppercase font-semibold tracking-wide">Current Price</p>
              <p className="text-3xl font-bold text-amber-700">${silver.gramPrice?.toFixed(2)}<span className="text-base font-normal text-amber-500">/gram</span></p>
            </div>
            <div className="text-right text-sm text-amber-600">
              <p>Updated: {new Date(silver.createdAt || Date.now()).toLocaleDateString()}</p>
              <p className="capitalize">Source: {silver.source}</p>
            </div>
          </div>
        )}

        {can('owner','manager') ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="New Price ($/gram) *">
                <input className="input" type="number" step="0.001" min="0.01" value={priceForm.gramPrice}
                  onChange={e=>setPriceForm(f=>({...f,gramPrice:e.target.value}))} placeholder="0.87" />
              </Field>
              <Field label="Notes">
                <input className="input" value={priceForm.notes} onChange={e=>setPriceForm(f=>({...f,notes:e.target.value}))} placeholder="Market source, reason..." />
              </Field>
            </div>
            <button onClick={updatePrice} disabled={saving} className="btn-primary">
              {saving?<Spinner size="sm"/>:null} Update Silver Price
            </button>
            <p className="text-xs text-gray-400">⚠️ Updating the price will affect all product retail and wholesale prices immediately.</p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Only owners and managers can update the silver price.</p>
        )}
      </div>

      {/* Price history */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Price History</h2>
        {history.length ? (
          <div className="space-y-2">
            {history.slice(0,15).map((h, i) => (
              <div key={h._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  {i === 0 && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Current</span>}
                  <span className="text-gray-400 text-xs">{new Date(h.createdAt).toLocaleString()}</span>
                  {h.notes && <span className="text-gray-400 text-xs italic">"{h.notes}"</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 text-xs">by {h.setBy?.name || 'system'}</span>
                  <span className="font-bold text-amber-600 font-mono">${h.gramPrice?.toFixed(3)}/g</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400 text-sm">No price history</p>}
      </div>

      {/* Account info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Account</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[['Name', user?.name], ['Email', user?.email], ['Role', user?.role], ['Status', 'Active']].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{k}</p>
              <p className="font-medium text-gray-900 capitalize">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role permissions reference */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Role Permissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="th">Role</th><th className="th">Products</th><th className="th">POS</th><th className="th">Customers</th><th className="th">Reports</th><th className="th">Settings</th></tr></thead>
            <tbody className="divide-y text-center">
              {[
                ['owner',      '✅ Full', '✅', '✅ Full', '✅', '✅'],
                ['manager',    '✅ Edit',  '✅', '✅ Edit',  '✅', '✅ Price only'],
                ['cashier',    '👁 View',  '✅', '✅ Create','❌', '❌'],
                ['wholesaler', '👁 WS only','❌','❌',       '❌', '❌'],
                ['viewer',     '👁 View',  '❌', '❌',       '❌', '❌'],
              ].map(([role, ...perms]) => (
                <tr key={role} className={`hover:bg-gray-50 ${role===user?.role?'bg-amber-50':''}`}>
                  <td className="td text-left font-semibold capitalize">{role} {role===user?.role&&'← you'}</td>
                  {perms.map((p, i) => <td key={i} className="td">{p}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
