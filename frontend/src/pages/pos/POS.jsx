import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import toast from 'react-hot-toast';
import { productAPI, customerAPI, saleAPI } from '../../api';
import { Spinner } from '../../components/ui';
import PaymentModal from '../../components/ui/PaymentModal';

export default function POS() {
  const [cart, setCart]               = useState([]);
  const [scanQuery, setScanQuery]     = useState('');
  const [scanning, setScanning]       = useState(false);
  const [customers, setCustomers]     = useState([]);
  const [custSearch, setCustSearch]   = useState('');
  const [customer, setCustomer]       = useState(null);
  const [saleType, setSaleType]       = useState('retail');
  const [globalDiscount, setGlobal]   = useState(0);
  const [notes, setNotes]             = useState('');
  const [processing, setProcessing]   = useState(false);
  const [receipt, setReceipt]         = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrPreview, setQrPreview]     = useState(null);
  const [qrDecoded, setQrDecoded]     = useState(null);

  const scanRef   = useRef(null);
  const fileRef   = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  useEffect(() => {
    if (!custSearch.trim()) { setCustomers([]); return; }
    const t = setTimeout(() => {
      customerAPI.list({ search: custSearch, limit: 8 })
        .then(r => setCustomers(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  const addToCart = useCallback(async (query) => {
    const q = query?.trim();
    if (!q) return;
    setScanning(true);
    try {
      const { data } = await productAPI.scan(q);
      const p = data.data;
      setCart(prev => {
        const exists = prev.find(i => i._id === p._id);
        if (exists) { toast.success(`+1 ${p.name}`); return prev.map(i => i._id===p._id?{...i,qty:i.qty+1}:i); }
        toast.success(`Added: ${p.name}`);
        return [...prev, { ...p, qty: 1, discount: 0 }];
      });
      setScanQuery(''); setQrPreview(null); setQrDecoded(null);
    } catch { toast.error(`Not found: "${q}"`); }
    finally { setScanning(false); setTimeout(() => scanRef.current?.focus(), 100); }
  }, []);

  const handleKeyDown = (e) => { if (e.key==='Enter' && scanQuery.trim()) addToCart(scanQuery.trim()); };

  const handleQRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    setQrUploading(true); setQrPreview(null); setQrDecoded(null);
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res,rej) => { img.onload=res; img.onerror=rej; img.src=objectUrl; });
      setQrPreview(objectUrl);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
      ctx.drawImage(img,0,0);
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      let result = jsQR(imageData.data,canvas.width,canvas.height,{inversionAttempts:'dontInvert'});
      if (!result) result = jsQR(imageData.data,canvas.width,canvas.height,{inversionAttempts:'onlyInvert'});
      if (!result) { toast.error('No QR detected. Try a clearer image.'); setQrPreview(null); return; }
      let sku=result.data.trim(), productName=null;
      try { const p=JSON.parse(result.data); if(p.sku){sku=p.sku;productName=p.name;} } catch {
        const m=result.data.match(/\/([A-Z0-9a-z_-]{3,})(?:\?.*)?$/); if(m) sku=m[1].toUpperCase();
      }
      setQrDecoded({sku,productName});
      toast.success(`QR: ${productName||sku}`,{icon:'📷'});
      await addToCart(sku);
    } catch { toast.error('Could not read image'); setQrPreview(null); }
    finally { setQrUploading(false); if(fileRef.current) fileRef.current.value=''; }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer(); dt.items.add(file);
      fileRef.current.files = dt.files;
      handleQRUpload({ target: fileRef.current });
    }
  };

  const updateQty  = (id,qty) => { if(qty<1) removeItem(id); else setCart(c=>c.map(i=>i._id===id?{...i,qty}:i)); };
  const updateDisc = (id,d)   => setCart(c=>c.map(i=>i._id===id?{...i,discount:Math.min(100,Math.max(0,d))}:i));
  const removeItem = (id)     => setCart(c=>c.filter(i=>i._id!==id));
  const clearCart  = ()       => { setCart([]); setCustomer(null); setCustSearch(''); setReceipt(null); setNotes(''); setQrPreview(null); setQrDecoded(null); };

  const getUnitPrice = (item) => saleType==='wholesale'?(item.prices?.wholesalePrice||0):(item.prices?.retailPrice||0);
  const lineTotal    = (item) => getUnitPrice(item)*item.qty*(1-item.discount/100);
  const subtotal     = cart.reduce((s,i)=>s+lineTotal(i),0);
  const discAmt      = subtotal*(globalDiscount/100);
  const total        = subtotal-discAmt;

  const handlePaymentComplete = async ({ paymentMethod, amountPaid, stripePaymentId, notes: payNotes }) => {
    setShowPayment(false);
    setProcessing(true);
    try {
      const { data } = await saleAPI.checkout({
        saleType, isWalkIn: !customer, customerId: customer?._id,
        paymentMethod, amountPaid, stripePaymentId: stripePaymentId||null,
        globalDiscount,
        notes: [notes, payNotes].filter(Boolean).join(' | ') || '',
        items: cart.map(i=>({ productId: i._id, quantity: i.qty, discount: i.discount })),
      });
      setReceipt(data.invoice);
      toast.success('Sale completed! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally { setProcessing(false); }
  };

  if (receipt) return <Receipt receipt={receipt} onNew={clearCart} />;

  return (
    <div className="flex gap-6" style={{ height:'calc(100vh - 8rem)' }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Left */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
        <div className="card p-4">
          <label className="label mb-2">Add Product</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input ref={scanRef} value={scanQuery} onChange={e=>setScanQuery(e.target.value)}
                onKeyDown={handleKeyDown} placeholder="Type SKU + Enter…"
                className="input pl-9 font-mono text-sm" autoComplete="off" />
            </div>
            <button onClick={()=>fileRef.current?.click()} disabled={qrUploading} className="btn-secondary flex-shrink-0">
              {qrUploading?<Spinner size="sm"/>:<span>📷</span>}
              <span className="text-sm">{qrUploading?'Reading…':'Upload QR'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleQRUpload} />
          </div>
          <div onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
            onDragEnter={e=>e.currentTarget.classList.add('border-amber-400','bg-amber-50')}
            onDragLeave={e=>e.currentTarget.classList.remove('border-amber-400','bg-amber-50')}
            onClick={()=>fileRef.current?.click()}
            className="mt-3 border-2 border-dashed border-gray-200 rounded-xl p-3 flex items-center justify-center gap-3 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all group">
            {qrPreview ? (
              <><img src={qrPreview} alt="QR" className="w-12 h-12 object-contain rounded-lg border" />
                <div><p className="text-xs font-semibold text-green-600">✅ QR decoded</p>
                  {qrDecoded&&<p className="text-xs text-gray-500 font-mono">{qrDecoded.productName||qrDecoded.sku}</p>}</div></>
            ) : (
              <><span className="text-2xl opacity-40">📷</span>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500">Drop QR image or click to upload</p>
                  <p className="text-xs text-gray-400">Photo of printed QR label</p>
                </div></>
            )}
          </div>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-900">Cart <span className="text-gray-400 font-normal text-sm">({cart.length})</span></h3>
            {cart.length>0&&<button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600">🗑 Clear</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <p className="text-5xl">🛒</p><p className="text-sm">Cart is empty</p>
                <p className="text-xs text-gray-400">Type SKU or upload QR</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => {
                  const up=getUnitPrice(item),lt=lineTotal(item);
                  return (
                    <div key={item._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.sku} · {item.weightGram}g · {item.purity}</p>
                        <p className="text-xs text-amber-600 font-semibold">${up.toFixed(2)} / pc</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input type="number" min="0" max="100" value={item.discount}
                          onChange={e=>updateDisc(item._id,parseFloat(e.target.value)||0)}
                          className="w-14 text-center border rounded-lg py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                      <div className="flex items-center border rounded-lg overflow-hidden flex-shrink-0">
                        <button onClick={()=>updateQty(item._id,item.qty-1)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                        <button onClick={()=>updateQty(item._id,item.qty+1)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold">+</button>
                      </div>
                      <span className="w-20 text-right font-bold text-sm flex-shrink-0">${lt.toFixed(2)}</span>
                      <button onClick={()=>removeItem(item._id)} className="text-red-300 hover:text-red-500 text-xl leading-none">×</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {cart.length>0&&(
            <div className="p-4 border-t bg-gray-50 rounded-b-xl space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discAmt>0&&<div className="flex justify-between text-sm text-red-500"><span>Discount ({globalDiscount}%)</span><span>−${discAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 text-lg pt-1 border-t"><span>Total</span><span>${total.toFixed(2)}</span></div>
              <div className="text-xs text-gray-400 text-right">{cart.reduce((s,i)=>s+i.qty*(i.weightGram||0),0).toFixed(2)}g silver</div>
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
        <div className="card p-4">
          <label className="label">Sale Type</label>
          <div className="flex bg-gray-100 rounded-lg p-1 mt-1">
            {['retail','wholesale'].map(t=>(
              <button key={t} onClick={()=>setSaleType(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all ${saleType===t?'bg-white shadow text-amber-600':'text-gray-500 hover:text-gray-700'}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <label className="label">Customer</label>
          {customer ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              <div><p className="font-medium text-sm">{customer.name}</p><p className="text-xs text-gray-400">{customer.customerCode} · {customer.type}</p></div>
              <button onClick={()=>{setCustomer(null);setCustSearch('');}} className="text-red-400 hover:text-red-600 text-xl">×</button>
            </div>
          ) : (
            <div className="relative mt-1">
              <input value={custSearch} onChange={e=>setCustSearch(e.target.value)} placeholder="Search or walk-in…" className="input text-sm" />
              {customers.length>0&&(
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                  {customers.map(c=>(
                    <button key={c._id} onClick={()=>{setCustomer(c);setCustomers([]);setCustSearch('');}}
                      className="w-full text-left px-3 py-2.5 hover:bg-amber-50 border-b last:border-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.customerCode} · {c.type}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Leave empty for walk-in</p>
            </div>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div>
            <label className="label text-xs">Global Discount (%)</label>
            <input className="input text-sm" type="number" min="0" max="100"
              value={globalDiscount} onChange={e=>setGlobal(parseFloat(e.target.value)||0)} />
          </div>
          <div>
            <label className="label text-xs">Notes</label>
            <textarea className="input text-sm resize-none h-14" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional…" />
          </div>
        </div>

        {cart.length>0&&(
          <div className="card p-4 bg-slate-50 space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>Items</span><span>{cart.reduce((s,i)=>s+i.qty,0)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Weight</span><span>{cart.reduce((s,i)=>s+i.qty*(i.weightGram||0),0).toFixed(2)}g</span></div>
            {discAmt>0&&<div className="flex justify-between text-sm text-red-500"><span>Discount</span><span>−${discAmt.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-lg border-t pt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        )}

        <button onClick={()=>{ if(!cart.length) return toast.error('Cart is empty'); setShowPayment(true); }}
          disabled={!cart.length||processing}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg shadow-green-200">
          {processing?<Spinner size="sm"/>:'💳'}
          {processing?'Processing…':`Pay $${total.toFixed(2)}`}
        </button>
      </div>

      <PaymentModal open={showPayment} total={total} customer={customer}
        onComplete={handlePaymentComplete} onCancel={()=>setShowPayment(false)} />
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
            ['Customer',    typeof receipt.customer==='object'?receipt.customer?.name:(receipt.customer||'Walk-in')],
            ['Type',        receipt.saleType],
            ['Items',       receipt.items],
            ['Weight',      receipt.totalWeightGram],
            ['Subtotal',    `$${receipt.subtotal}`],
            parseFloat(receipt.discount)>0&&['Discount',`-$${receipt.discount}`],
            ['Tax',         `$${receipt.tax}`],
            ['Total',       `$${receipt.totalAmount}`],
            ['Paid',        `$${receipt.amountPaid}`],
            parseFloat(receipt.changeGiven)>0&&['Change',`$${receipt.changeGiven}`],
            parseFloat(receipt.creditAmount)>0&&['Credit',`$${receipt.creditAmount}`],
            ['Payment',     receipt.paymentMethod?.replace('_',' ')],
            ['Cashier',     receipt.cashier],
            ['Silver Rate', `$${receipt.silverGramPrice}/g`],
          ].filter(Boolean).map(([k,v])=>(
            <div key={k} className={`flex justify-between ${k==='Total'?'font-bold text-base border-t pt-2':''}`}>
              <span className="text-gray-500">{k}</span>
              <span className={`font-medium capitalize ${k==='Total'?'text-green-600':''}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={()=>window.print()} className="btn-secondary flex-1">🖨 Print</button>
          <button onClick={onNew} className="btn-primary flex-1">+ New Sale</button>
        </div>
      </div>
    </div>
  );
}