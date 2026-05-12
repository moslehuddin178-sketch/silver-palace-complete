import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { productAPI, customerAPI, saleAPI } from '../../api';
import { Spinner, Badge, StatusBadge } from '../../components/ui';

export default function POS() {
  const [cart, setCart]           = useState([]);
  const [scanQuery, setScanQuery] = useState('');
  const [scanning, setScanning]   = useState(false);
  const [customers, setCustomers] = useState([]);
  const [custSearch, setCustSearch] = useState('');
  const [customer, setCustomer]   = useState(null);
  const [saleType, setSaleType]   = useState('retail');
  const [payMethod, setPayMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [globalDiscount, setGlobal] = useState(0);
  const [notes, setNotes]         = useState('');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt]     = useState(null);
  const scanRef = useRef(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  useEffect(() => {
    if (!custSearch) { setCustomers([]); return; }
    const t = setTimeout(() => {
      customerAPI.list({ search: custSearch, type: saleType === 'wholesale' ? 'wholesale' : '', limit: 8 })
        .then(r => setCustomers(r.data.data))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch, saleType]);

  const handleScan = async (e) => {
    if (e.key !== 'Enter' || !scanQuery.trim()) return;
    setScanning(true);
    try {
      const { data } = await productAPI.scan(scanQuery.trim());
      const p = data.data;
      const existing = cart.find(i => i._id === p._id);
      if (existing) {
        setCart(c => c.map(i => i._id === p._id ? { ...i, qty: i.qty + 1 } : i));
        toast.success(`+1 ${p.name}`);
      } else {
        setCart(c => [...c, { ...p, qty: 1, discount: 0 }]);
        toast.success(`Added: ${p.name}`);
      }
      setScanQuery('');
    } catch { toast.error(`Not found: "${scanQuery}"`); }
    finally { setScanning(false); scanRef.current?.focus(); }
  };

  const updateQty  = (id, qty) => { if (qty < 1) removeItem(id); else setCart(c => c.map(i => i._id===id?{...i,qty}:i)); };
  const updateDisc = (id, d)   => setCart(c => c.map(i => i._id===id?{...i,discount:Math.min(100,Math.max(0,d))}:i));
  const removeItem = (id)      => setCart(c => c.filter(i => i._id !== id));
  const clearCart  = ()        => { setCart([]); setCustomer(null); setCustSearch(''); setReceipt(null); setAmountPaid(''); setNotes(''); };

  const getUnitPrice = (item) => {
    const p = item.prices;
    return saleType === 'wholesale' ? (p?.wholesalePrice || 0) : (p?.retailPrice || 0);
  };

  const lineTotal  = (item) => getUnitPrice(item) * item.qty * (1 - item.discount / 100);
  const subtotal   = cart.reduce((s, i) => s + lineTotal(i), 0);
  const discAmt    = subtotal * (globalDiscount / 100);
  const afterDisc  = subtotal - discAmt;
  const total      = afterDisc;
  const change     = payMethod === 'cash' && amountPaid ? Math.max(0, parseFloat(amountPaid) - total) : 0;

  const checkout = async () => {
    if (!cart.length) return toast.error('Cart is empty');
    setProcessing(true);
    try {
      const payload = {
        saleType,
        isWalkIn: !customer,
        customerId: customer?._id,
        paymentMethod: payMethod,
        amountPaid: parseFloat(amountPaid) || total,
        globalDiscount,
        notes,
        items: cart.map(i => ({ productId: i._id, quantity: i.qty, discount: i.discount })),
      };
      const { data } = await saleAPI.checkout(payload);
      setReceipt(data.invoice);
      toast.success('Sale completed! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally { setProcessing(false); }
  };

  if (receipt) return <Receipt receipt={receipt} onNew={clearCart} />;

  return (
    <div className="flex gap-6 h-full" style={{ maxHeight:'calc(100vh - 8rem)' }}>
      {/* Left: Scan & Cart */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Scan bar */}
        <div className="card p-4">
          <label className="label">Scan QR / Enter SKU</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📷</span>
              <input ref={scanRef} value={scanQuery} onChange={e=>setScanQuery(e.target.value)} onKeyDown={handleScan}
                placeholder="Scan QR code or type SKU, press Enter..."
                className="input pl-9 font-mono text-sm" autoFocus />
            </div>
            {scanning && <div className="flex items-center px-3"><Spinner size="sm" /></div>}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Press Enter after typing or scanning to add to cart</p>
        </div>

        {/* Cart */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-900">Cart <span className="text-gray-400 font-normal text-sm">({cart.length} items)</span></h3>
            {cart.length > 0 && <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600">🗑 Clear</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <p className="text-5xl mb-3">🛒</p>
                <p className="text-sm">Cart is empty — scan a product to start</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => {
                  const up = getUnitPrice(item);
                  const lt = lineTotal(item);
                  return (
                    <div key={item._id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.sku} · {item.weightGram}g · {item.purity}</p>
                        <p className="text-xs text-amber-600 font-semibold mt-0.5">${up.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="100" value={item.discount}
                            onChange={e=>updateDisc(item._id, parseFloat(e.target.value)||0)}
                            className="w-14 text-center border rounded-lg py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                        {/* Qty */}
                        <div className="flex items-center border rounded-lg overflow-hidden">
                          <button onClick={()=>updateQty(item._id, item.qty-1)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm">−</button>
                          <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                          <button onClick={()=>updateQty(item._id, item.qty+1)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm">+</button>
                        </div>
                        <span className="w-20 text-right font-bold text-sm text-gray-900">${lt.toFixed(2)}</span>
                        <button onClick={()=>removeItem(item._id)} className="text-red-300 hover:text-red-500 text-lg leading-none">×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Totals */}
          {cart.length > 0 && (
            <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discAmt > 0 && <div className="flex justify-between text-sm text-red-500"><span>Discount ({globalDiscount}%)</span><span>−${discAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 pt-1 border-t text-lg"><span>Total</span><span>${total.toFixed(2)}</span></div>
              <div className="text-xs text-gray-400 text-right">{cart.reduce((s,i)=>s+i.qty*i.weightGram,0).toFixed(2)}g total weight</div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Payment panel */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
        {/* Sale type */}
        <div className="card p-4">
          <label className="label">Sale Type</label>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {['retail','wholesale'].map(t => (
              <button key={t} onClick={()=>setSaleType(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize ${saleType===t?'bg-white shadow text-amber-600':'text-gray-500 hover:text-gray-700'}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Customer */}
        <div className="card p-4">
          <label className="label">Customer</label>
          {customer ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div>
                <p className="font-medium text-gray-900 text-sm">{customer.name}</p>
                <p className="text-xs text-gray-400">{customer.customerCode} · {customer.phone}</p>
              </div>
              <button onClick={()=>{setCustomer(null);setCustSearch('');}} className="text-red-400 hover:text-red-600">×</button>
            </div>
          ) : (
            <div className="relative">
              <input value={custSearch} onChange={e=>setCustSearch(e.target.value)}
                placeholder="Search or walk-in..." className="input text-sm" />
              {customers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-20 overflow-hidden">
                  {customers.map(c => (
                    <button key={c._id} onClick={()=>{setCustomer(c);setCustomers([]);setCustSearch('');}}
                      className="w-full text-left px-3 py-2.5 hover:bg-amber-50 transition-colors border-b last:border-0">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.customerCode} · {c.type} · {c.phone}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Leave empty for walk-in customer</p>
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="card p-4 space-y-3">
          <label className="label">Payment</label>
          <div>
            <label className="label">Method</label>
            <select className="input text-sm" value={payMethod} onChange={e=>setPayMethod(e.target.value)}>
              {['cash','card','bank_transfer','credit','mixed'].map(m => (
                <option key={m} value={m} className="capitalize">{m.replace('_',' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Global Discount (%)</label>
            <input className="input text-sm" type="number" min="0" max="100" value={globalDiscount} onChange={e=>setGlobal(parseFloat(e.target.value)||0)} />
          </div>
          {payMethod === 'cash' && (
            <div>
              <label className="label">Amount Received ($)</label>
              <input className="input text-sm font-mono" type="number" step="0.01" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} placeholder={total.toFixed(2)} />
              {parseFloat(amountPaid) > 0 && (
                <div className={`mt-2 p-2 rounded-lg text-center text-sm font-semibold ${change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                  {change >= 0 ? `Change: $${change.toFixed(2)}` : `Short: $${Math.abs(change).toFixed(2)}`}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea className="input text-sm resize-none h-14" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional sale notes..." />
          </div>
        </div>

        {/* Checkout button */}
        <button onClick={checkout} disabled={!cart.length || processing}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg shadow-lg shadow-green-200">
          {processing ? <Spinner size="sm" /> : '✓'}
          {processing ? 'Processing...' : `Complete Sale · $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

function Receipt({ receipt, onNew }) {
  return (
    <div className="max-w-md mx-auto">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Sale Complete!</h2>
        <p className="text-gray-400 text-sm mb-6 font-mono">{receipt.invoiceNo}</p>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-left mb-6">
          {[
            ['Customer',       receipt.customer === 'Walk-in' ? 'Walk-in' : receipt.customer?.name || 'Walk-in'],
            ['Type',           receipt.saleType],
            ['Items',          receipt.items],
            ['Total Weight',   receipt.totalWeightGram],
            ['Subtotal',       `$${receipt.subtotal}`],
            receipt.discount > 0 && ['Discount', `-$${receipt.discount}`],
            ['Tax',            `$${receipt.tax}`],
            ['Total',          `$${receipt.totalAmount}`],
            ['Paid',           `$${receipt.amountPaid}`],
            parseFloat(receipt.changeGiven) > 0 && ['Change', `$${receipt.changeGiven}`],
            parseFloat(receipt.creditAmount) > 0 && ['Credit', `$${receipt.creditAmount}`],
            ['Payment',        receipt.paymentMethod],
            ['Cashier',        receipt.cashier],
            ['Silver Rate',    `$${receipt.silverGramPrice}/g`],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} className={`flex justify-between ${k==='Total'?'font-bold text-base border-t pt-2':''}`}>
              <span className="text-gray-500">{k}</span>
              <span className={`font-medium capitalize ${k==='Total'?'text-green-600':''}`}>{v}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn-secondary flex-1">🖨 Print</button>
          <button onClick={onNew} className="btn-primary flex-1">+ New Sale</button>
        </div>
      </div>
    </div>
  );
}
