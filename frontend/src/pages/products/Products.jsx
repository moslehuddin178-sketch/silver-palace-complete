import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productAPI } from '../../api';
import { Table, Pagination, PageHeader, StatusBadge, Modal, Field, Spinner, Confirm, Badge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['ring','necklace','bracelet','earring','anklet','pendant','chain','brooch','set','bangle','other'];
const PURITIES   = ['925','950','999','800','custom'];
const FINISHES   = ['polished','matte','oxidized','hammered','brushed','rhodium_plated','gold_plated'];

const EMPTY_FORM = {
  sku:'', name:'', category:'ring', purity:'925', weightGram:'', netWeightGram:'',
  finish:'polished', gender:'women', collectionName:'', laborCost:'', stoneCost:'',
  retailMarkup:200, wholesaleMarkup:80, stockQty:0, minimumStock:3,
  warehouse:'Main Showroom', shelfLocation:'', description:'',
  availableForWholesale:true, isFeatured:false, isNewArrival:false, isBestSeller:false,
  tags:'', manufacturer:'', fixedRetailPrice:'', fixedWholesalePrice:'',
};

export default function Products() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCat]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [modal, setModal]         = useState(null); // 'create' | 'edit' | 'qr' | 'stock'
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [confirm, setConfirm]     = useState(false);
  const [stockForm, setStockForm] = useState({ type:'add', quantity:'', reason:'' });

  const load = useCallback(() => {
    setLoading(true);
    productAPI.list({ search, category: catFilter, status: statusFilter, page, limit: 20 })
      .then(r => { setProducts(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, [search, catFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setSelected(null); setModal('create'); };
  const openEdit   = (p)  => { setSelected(p); setForm({ ...EMPTY_FORM, ...p, tags: p.tags?.join(', ') || '' }); setModal('edit'); };
  const openQR     = (p)  => { setSelected(p); setModal('qr'); };
  const openStock  = (p)  => { setSelected(p); setStockForm({ type:'add', quantity:'', reason:'' }); setModal('stock'); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags?.split(',').map(t=>t.trim()).filter(Boolean) };
      if (modal === 'create') await productAPI.create(payload);
      else                    await productAPI.update(selected._id, payload);
      toast.success(modal === 'create' ? 'Product created with QR!' : 'Product updated');
      setModal(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await productAPI.delete(selected._id);
      toast.success('Product deleted');
      setConfirm(false); setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleStock = async () => {
    setSaving(true);
    try {
      await productAPI.adjustStock(selected._id, stockForm);
      toast.success('Stock updated');
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Stock update failed'); }
    finally { setSaving(false); }
  };

  const regenQR = async (p) => {
    const t = toast.loading('Regenerating QR...');
    try {
      const r = await productAPI.regenQR(p._id);
      setSelected({ ...p, qrCode: r.data.qrCode });
      toast.success('QR regenerated', { id: t });
    } catch { toast.error('Failed', { id: t }); }
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const columns = [
    { key:'sku',       label:'SKU',      render: v => <span className="font-mono text-xs font-semibold text-amber-600">{v}</span> },
    { key:'name',      label:'Product',  render: (v, row) => <div><p className="font-medium text-gray-900">{v}</p><p className="text-xs text-gray-400 capitalize">{row.category} · {row.purity}</p></div> },
    { key:'weightGram',label:'Weight',   render: v => <span className="font-mono text-sm">{v}g</span> },
    { key:'prices',    label:'Price',    render: (v) => v ? <div><p className="text-sm font-semibold text-green-600">${v.retailPrice?.toFixed(2)}</p><p className="text-xs text-gray-400">WS: ${v.wholesalePrice?.toFixed(2)}</p></div> : '—' },
    { key:'stockQty',  label:'Stock',    render: (v, row) => <div><span className={`font-mono text-sm font-bold ${v === 0 ? 'text-red-500' : v <= row.minimumStock ? 'text-amber-500' : 'text-gray-900'}`}>{v}</span></div> },
    { key:'status',    label:'Status',   render: v => <StatusBadge status={v} /> },
    { key:'warehouse', label:'Location', render: (v, row) => <div><p className="text-sm">{v}</p><p className="text-xs text-gray-400">{row.shelfLocation}</p></div> },
    { key:'_id',       label:'Actions',  render: (_, row) => (
      <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
        <button onClick={()=>openQR(row)}    className="btn-ghost py-1 px-2 text-xs" title="View QR">📷</button>
        <button onClick={()=>openStock(row)} className="btn-ghost py-1 px-2 text-xs" title="Adjust stock">📦</button>
        {can('owner','manager') && <button onClick={()=>openEdit(row)} className="btn-ghost py-1 px-2 text-xs">✏️</button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Products" subtitle={`${total} items in inventory`}
        action={can('owner','manager') && <button className="btn-primary" onClick={openCreate}>+ Add Product</button>} />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search SKU, name, tags..." className="input max-w-xs" />
        <select value={catFilter} onChange={e=>{setCat(e.target.value);setPage(1);}} className="input w-40">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>{setStatus(e.target.value);setPage(1);}} className="input w-40">
          <option value="">All Status</option>
          {['active','low_stock','out_of_stock','inactive'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <button className="btn-secondary text-sm" onClick={()=>{setSearch('');setCat('');setStatus('');setPage(1);}}>Reset</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table columns={columns} data={products} loading={loading} />
        <Pagination page={page} pages={pages} total={total} limit={20} onChange={setPage} />
      </div>

      {/* Create / Edit Modal */}
      <Modal open={modal==='create'||modal==='edit'} onClose={()=>setModal(null)}
        title={modal==='create' ? '+ New Product' : `Edit: ${selected?.sku}`} size="xl">
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU *"><input className="input" value={form.sku} onChange={e=>f('sku',e.target.value)} placeholder="RNG-001" disabled={modal==='edit'} /></Field>
          <Field label="Product Name *"><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Sterling Silver Ring" /></Field>
          <Field label="Category *">
            <select className="input" value={form.category} onChange={e=>f('category',e.target.value)}>
              {CATEGORIES.map(c=><option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </Field>
          <Field label="Purity">
            <select className="input" value={form.purity} onChange={e=>f('purity',e.target.value)}>
              {PURITIES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Gross Weight (g) *"><input className="input" type="number" step="0.01" value={form.weightGram} onChange={e=>f('weightGram',e.target.value)} /></Field>
          <Field label="Net Weight (g)"><input className="input" type="number" step="0.01" value={form.netWeightGram} onChange={e=>f('netWeightGram',e.target.value)} /></Field>
          <Field label="Finish">
            <select className="input" value={form.finish} onChange={e=>f('finish',e.target.value)}>
              {FINISHES.map(x=><option key={x} value={x} className="capitalize">{x.replace('_',' ')}</option>)}
            </select>
          </Field>
          <Field label="Gender">
            <select className="input" value={form.gender} onChange={e=>f('gender',e.target.value)}>
              {['women','men','unisex','kids'].map(g=><option key={g} value={g} className="capitalize">{g}</option>)}
            </select>
          </Field>
          <Field label="Labor Cost ($)"><input className="input" type="number" step="0.01" value={form.laborCost} onChange={e=>f('laborCost',e.target.value)} /></Field>
          <Field label="Stone Cost ($)"><input className="input" type="number" step="0.01" value={form.stoneCost} onChange={e=>f('stoneCost',e.target.value)} /></Field>
          <Field label="Retail Markup (%)"><input className="input" type="number" value={form.retailMarkup} onChange={e=>f('retailMarkup',e.target.value)} /></Field>
          <Field label="Wholesale Markup (%)"><input className="input" type="number" value={form.wholesaleMarkup} onChange={e=>f('wholesaleMarkup',e.target.value)} /></Field>
          <Field label="Fixed Retail Price ($) (optional)"><input className="input" type="number" step="0.01" value={form.fixedRetailPrice} onChange={e=>f('fixedRetailPrice',e.target.value)} /></Field>
          <Field label="Fixed Wholesale Price ($) (optional)"><input className="input" type="number" step="0.01" value={form.fixedWholesalePrice} onChange={e=>f('fixedWholesalePrice',e.target.value)} /></Field>
          <Field label="Stock Qty"><input className="input" type="number" value={form.stockQty} onChange={e=>f('stockQty',e.target.value)} /></Field>
          <Field label="Minimum Stock"><input className="input" type="number" value={form.minimumStock} onChange={e=>f('minimumStock',e.target.value)} /></Field>
          <Field label="Warehouse"><input className="input" value={form.warehouse} onChange={e=>f('warehouse',e.target.value)} /></Field>
          <Field label="Shelf Location"><input className="input" value={form.shelfLocation} onChange={e=>f('shelfLocation',e.target.value)} placeholder="A-12" /></Field>
          <Field label="Collection"><input className="input" value={form.collectionName} onChange={e=>f('collectionName',e.target.value)} /></Field>
          <Field label="Manufacturer"><input className="input" value={form.manufacturer} onChange={e=>f('manufacturer',e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Tags (comma separated)"><input className="input" value={form.tags} onChange={e=>f('tags',e.target.value)} placeholder="ring, classic, women" /></Field></div>
          <div className="col-span-2"><Field label="Description"><textarea className="input h-20 resize-none" value={form.description} onChange={e=>f('description',e.target.value)} /></Field></div>
          <div className="col-span-2 flex flex-wrap gap-4">
            {[['availableForWholesale','Available for Wholesale'],['isFeatured','Featured'],['isNewArrival','New Arrival'],['isBestSeller','Best Seller']].map(([k,l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form[k]} onChange={e=>f(k,e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm text-gray-700">{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t">
          {modal==='edit' && can('owner') && <button className="btn-danger text-sm" onClick={()=>setConfirm(true)}>🗑 Delete</button>}
          <div className="flex gap-3 ml-auto">
            <button className="btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?<Spinner size="sm"/>:null} Save Product</button>
          </div>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal open={modal==='qr'} onClose={()=>setModal(null)} title={`QR Code — ${selected?.sku}`} size="sm">
        {selected?.qrCode ? (
          <div className="text-center">
            <img src={selected.qrCode} alt="QR Code" className="w-52 h-52 mx-auto border-8 border-gray-100 rounded-xl mb-4" />
            <p className="font-bold text-gray-900">{selected.name}</p>
            <p className="text-gray-400 text-xs font-mono mb-4">{selected.sku} · {selected.purity} · {selected.weightGram}g</p>
            <div className="flex gap-2 justify-center">
              <a href={selected.qrCode} download={`${selected.sku}-qr.png`} className="btn-primary text-sm">⬇ Download QR</a>
              <button className="btn-secondary text-sm" onClick={()=>regenQR(selected)}>🔄 Regenerate</button>
            </div>
            <p className="text-xs text-gray-400 mt-3">Scan to get live price at POS</p>
          </div>
        ) : <p className="text-gray-400 text-center py-8">No QR generated yet. <button className="text-amber-500" onClick={()=>regenQR(selected)}>Generate now</button></p>}
      </Modal>

      {/* Stock Modal */}
      <Modal open={modal==='stock'} onClose={()=>setModal(null)} title={`Adjust Stock — ${selected?.name}`} size="sm">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400">Current Stock</p>
            <p className="text-3xl font-bold text-gray-900">{selected?.stockQty}</p>
          </div>
          <Field label="Operation">
            <select className="input" value={stockForm.type} onChange={e=>setStockForm(f=>({...f,type:e.target.value}))}>
              <option value="add">Add Stock</option>
              <option value="remove">Remove Stock</option>
              <option value="set">Set Exact Amount</option>
            </select>
          </Field>
          <Field label="Quantity"><input className="input" type="number" min="1" value={stockForm.quantity} onChange={e=>setStockForm(f=>({...f,quantity:e.target.value}))} /></Field>
          <Field label="Reason"><input className="input" value={stockForm.reason} onChange={e=>setStockForm(f=>({...f,reason:e.target.value}))} placeholder="Physical count, delivery, etc." /></Field>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={()=>setModal(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleStock} disabled={saving}>{saving?<Spinner size="sm"/>:null} Update Stock</button>
          </div>
        </div>
      </Modal>

      <Confirm open={confirm} onClose={()=>setConfirm(false)} onConfirm={handleDelete}
        title="Delete Product" message={`Are you sure you want to delete "${selected?.name}"? This cannot be undone.`} />
    </div>
  );
}
