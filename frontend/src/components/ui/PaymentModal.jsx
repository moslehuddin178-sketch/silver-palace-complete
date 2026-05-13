import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import toast from 'react-hot-toast';
import { paymentAPI } from '../../api';
import { Spinner } from './index';

const CARD_STYLE = {
  style: {
    base: {
      fontSize: '15px',
      color: '#111827',
      fontFamily: 'Inter, system-ui, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
  hidePostalCode: true,
};

function CardPaymentForm({ amount, onSuccess, onCancel }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading]     = useState(false);
  const [cardError, setCardError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setCardError('');
    try {
      const { data } = await paymentAPI.createIntent({ amount });
      const { clientSecret, intentId } = data;
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (error) { setCardError(error.message); toast.error(error.message); return; }
      if (paymentIntent.status === 'succeeded') {
        toast.success('Card payment successful!', { icon: '💳' });
        onSuccess({ stripePaymentId: intentId, amountPaid: amount });
      } else {
        setCardError(`Payment status: ${paymentIntent.status}`);
      }
    } catch (err) {
      setCardError(err.response?.data?.message || err.message || 'Payment failed');
      toast.error('Payment failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-gray-50">
        <CardElement options={CARD_STYLE} onChange={() => setCardError('')} />
      </div>
      {cardError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex gap-2">
          <span>⚠️</span>{cardError}
        </div>
      )}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-600 space-y-1">
        <p className="font-semibold">Test cards:</p>
        <p>✅ Success: <span className="font-mono">4242 4242 4242 4242</span></p>
        <p>❌ Decline: <span className="font-mono">4000 0000 0000 0002</span></p>
        <p>Any future date · any 3-digit CVC</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={handlePay} disabled={loading || !stripe}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
          {loading ? <Spinner size="sm" /> : '💳'}
          {loading ? 'Processing…' : `Pay $${parseFloat(amount).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

export default function PaymentModal({ open, total, onComplete, onCancel, customer }) {
  const [method, setMethod]         = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [bankRef, setBankRef]       = useState('');
  const [splitCash, setSplitCash]   = useState('');
  const [stripeLoaded, setStripe]   = useState(null);
  const [stripeEnabled, setEnabled] = useState(false);
  const [loadingConfig, setLC]      = useState(true);

  useEffect(() => {
    if (!open) return;
    setAmountPaid(total.toFixed(2));
    setMethod('cash');
    setBankRef('');
    setSplitCash('');
    paymentAPI.getConfig()
      .then(r => {
        const { publishableKey, stripeEnabled } = r.data;
        setEnabled(stripeEnabled);
        if (stripeEnabled && publishableKey)
          loadStripe(publishableKey).then(s => setStripe(s));
      })
      .catch(() => {})
      .finally(() => setLC(false));
  }, [open, total]);

  if (!open) return null;

  const change = method === 'cash' ? Math.max(0, parseFloat(amountPaid || 0) - total) : 0;
  const short  = method === 'cash' ? Math.max(0, total - parseFloat(amountPaid || 0)) : 0;
  const cashRemaining = method === 'mixed' ? Math.max(0, total - parseFloat(splitCash || 0)) : 0;

  const creditAvailable  = customer ? Math.max(0, (customer.creditLimit || 0) - (customer.creditUsed || 0)) : 0;
  const creditSufficient = creditAvailable >= total;

  const METHODS = [
    { key: 'cash',          icon: '💵', label: 'Cash'       },
    { key: 'card',          icon: '💳', label: 'Card'       },
    { key: 'bank_transfer', icon: '🏦', label: 'Bank'       },
    { key: 'credit',        icon: '📋', label: 'Credit'     },
    { key: 'mixed',         icon: '🔀', label: 'Mixed'      },
  ];

  const handleComplete = () => {
    if (method === 'cash') {
      const paid = parseFloat(amountPaid);
      if (isNaN(paid) || paid < 0) return toast.error('Enter amount received');
      onComplete({ paymentMethod: 'cash', amountPaid: paid, stripePaymentId: null });
    }
    if (method === 'bank_transfer') {
      if (!bankRef.trim()) return toast.error('Enter bank reference number');
      onComplete({ paymentMethod: 'bank_transfer', amountPaid: total, stripePaymentId: null, notes: `Bank ref: ${bankRef}` });
    }
    if (method === 'credit') {
      if (!customer) return toast.error('Select a customer first');
      if (!creditSufficient) return toast.error(`Insufficient credit. Available: $${creditAvailable.toFixed(2)}`);
      onComplete({ paymentMethod: 'credit', amountPaid: 0, stripePaymentId: null });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Payment</h2>
            <button onClick={onCancel} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
          </div>
          <p className="text-3xl font-bold text-amber-400">${total.toFixed(2)}</p>
          {customer && <p className="text-white/60 text-sm mt-1">{customer.name} · {customer.type}</p>}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-5 gap-1 mb-5">
            {METHODS.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  method === m.key ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                <span className="text-lg">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* ── CASH ─────────────────────────────────────────────────── */}
          {method === 'cash' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Amount Received ($)</label>
                <input type="number" step="0.01" value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)} autoFocus
                  className="w-full border-2 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:border-amber-400 font-mono" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[total, Math.ceil(total/10)*10, Math.ceil(total/50)*50, Math.ceil(total/100)*100]
                  .filter((v,i,a)=>a.indexOf(v)===i).slice(0,4)
                  .map(v=>(
                    <button key={v} onClick={()=>setAmountPaid(v.toFixed(2))}
                      className="bg-gray-100 hover:bg-amber-50 hover:border-amber-300 border rounded-lg py-2 text-sm font-semibold text-gray-700">
                      ${v.toFixed(0)}
                    </button>
                  ))}
              </div>
              {parseFloat(amountPaid) > 0 && (
                <div className={`rounded-xl p-4 text-center ${change>0?'bg-green-50 border-green-200':short>0?'bg-red-50 border-red-200':'bg-green-50 border-green-200'} border`}>
                  {change > 0 && <p className="text-green-600 font-bold text-xl">Change: ${change.toFixed(2)}</p>}
                  {short  > 0 && <p className="text-red-500 font-bold text-xl">Short: ${short.toFixed(2)}</p>}
                  {change === 0 && short === 0 && <p className="text-green-600 font-bold">Exact amount ✓</p>}
                </div>
              )}
              <button onClick={handleComplete}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl">
                💵 Complete Cash Sale
              </button>
            </div>
          )}

          {/* ── CARD ─────────────────────────────────────────────────── */}
          {method === 'card' && (
            <div>
              {loadingConfig ? (
                <div className="flex justify-center py-8"><Spinner size="lg" /></div>
              ) : !stripeEnabled ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                  <p className="font-semibold">⚠️ Stripe not configured</p>
                  <p>Add to <code className="bg-amber-100 px-1 rounded">backend/.env</code>:</p>
                  <code className="block bg-white border rounded p-2 text-xs font-mono">
                    STRIPE_SECRET_KEY=sk_test_...<br/>
                    STRIPE_PUBLISHABLE_KEY=pk_test_...
                  </code>
                  <p>Add to <code className="bg-amber-100 px-1 rounded">frontend/.env</code>:</p>
                  <code className="block bg-white border rounded p-2 text-xs font-mono">
                    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
                  </code>
                  <p>Get free keys at <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline">dashboard.stripe.com</a></p>
                </div>
              ) : stripeLoaded ? (
                <Elements stripe={stripeLoaded}>
                  <CardPaymentForm
                    amount={total}
                    onSuccess={({ stripePaymentId }) =>
                      onComplete({ paymentMethod: 'card', amountPaid: total, stripePaymentId })
                    }
                    onCancel={onCancel}
                  />
                </Elements>
              ) : <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
            </div>
          )}

          {/* ── BANK TRANSFER ─────────────────────────────────────────── */}
          {method === 'bank_transfer' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold">Bank Details</p>
                <div className="bg-white rounded-lg p-3 border font-mono text-xs space-y-1">
                  <p>Bank: <span className="font-semibold">Ziraat Bankası</span></p>
                  <p>IBAN: <span className="font-semibold">TR12 0001 0012 3456 7890 1234 56</span></p>
                  <p>Name: <span className="font-semibold">{process.env.SHOP_NAME || 'Silver Palace'}</span></p>
                  <p>Amount: <span className="font-semibold text-blue-700">${total.toFixed(2)}</span></p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bank Reference / Receipt No *</label>
                <input type="text" value={bankRef} onChange={e => setBankRef(e.target.value)}
                  placeholder="e.g. TRX-2024-001234" autoFocus
                  className="w-full border-2 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={handleComplete}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl">
                🏦 Confirm Bank Transfer
              </button>
            </div>
          )}

          {/* ── CREDIT ────────────────────────────────────────────────── */}
          {method === 'credit' && (
            <div className="space-y-4">
              {!customer ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-800 text-sm">
                  <p className="text-3xl mb-2">👥</p>
                  <p className="font-semibold">No customer selected</p>
                  <p className="mt-1 text-amber-600">Close and select a customer first.</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    {[
                      ['Customer',    customer.name],
                      ['Credit Limit',`$${(customer.creditLimit||0).toFixed(2)}`],
                      ['Used',        `$${(customer.creditUsed||0).toFixed(2)}`],
                    ].map(([k,v])=>(
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-semibold">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-semibold">Available</span>
                      <span className={`font-bold ${creditSufficient?'text-green-600':'text-red-500'}`}>
                        ${creditAvailable.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 text-center text-sm font-semibold border ${creditSufficient?'bg-green-50 text-green-700 border-green-200':'bg-red-50 text-red-600 border-red-200'}`}>
                    {creditSufficient
                      ? `✅ Credit approved for $${total.toFixed(2)}`
                      : `❌ Short by $${(total-creditAvailable).toFixed(2)}`}
                  </div>
                  <button onClick={handleComplete} disabled={!creditSufficient}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl">
                    📋 Charge to Credit Account
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── MIXED ─────────────────────────────────────────────────── */}
          {method === 'mixed' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cash Amount ($)</label>
                <input type="number" step="0.01" min="0" max={total}
                  value={splitCash} onChange={e => setSplitCash(e.target.value)}
                  placeholder="0.00" autoFocus
                  className="w-full border-2 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:border-amber-400 font-mono" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">${total.toFixed(2)}</span></div>
                <div className="flex justify-between text-green-600"><span>Cash</span><span className="font-semibold">${parseFloat(splitCash||0).toFixed(2)}</span></div>
                <div className="flex justify-between text-blue-600 border-t pt-1.5"><span className="font-semibold">Card charge</span><span className="font-bold">${cashRemaining.toFixed(2)}</span></div>
              </div>
              {cashRemaining > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Card payment for remaining ${cashRemaining.toFixed(2)}</p>
                  {!stripeEnabled ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">⚠️ Stripe not configured. Add keys to .env</p>
                  ) : stripeLoaded ? (
                    <Elements stripe={stripeLoaded}>
                      <CardPaymentForm
                        amount={cashRemaining}
                        onSuccess={({ stripePaymentId }) =>
                          onComplete({
                            paymentMethod: 'mixed',
                            amountPaid: total,
                            stripePaymentId,
                            notes: `Mixed: $${parseFloat(splitCash||0).toFixed(2)} cash + $${cashRemaining.toFixed(2)} card`,
                          })
                        }
                        onCancel={onCancel}
                      />
                    </Elements>
                  ) : <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}