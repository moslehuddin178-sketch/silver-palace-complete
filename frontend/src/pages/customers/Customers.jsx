import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { customerAPI } from '../../api';
import { Table, Pagination, PageHeader, Modal, Field, Spinner, StatusBadge, Badge, Confirm } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const EMPTY = { name:'', phone:'', phone2:'', email:'', type:'retail', companyName:'', taxNumber:'', creditLimit:'', discountRate:'', paymentTermDays:'', address:{ street:'', city:'', country:'Turkey' }, notes:'' };

export default function Customers() {
  const { can } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setType] = useState('');
  const [modal, setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    customerAPI.list({ search, type: typeFilter, page, limit: 20 })
      .then(r => { setCustomers(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  }, [search, typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setSelected(null); setModal('form'); };
  const openEdit   = (c) => { setSelected(c); setForm({ ...EMPTY, ...c }); setModal('form'); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!selected) await customerAPI.create(form);
      else           await customerAPI.update(selected._id, form);
      toast.success(selected ? 'Customer updated' : 'Customer created');
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await customerAPI.delete(selected._id); toast.success('Deleted'); setConfirm(false); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const columns = [
    { key:'customerCode', label:'Code',   render: v => <span className="font-mono text-xs font-semibold text-amber-600">{v}</span> },
    { key:'name',         label:'Name',   render: (v, r) => <div><p className="font-medium text-gray-900">{v}</p>{r.companyName&&<p className="text-xs text-gray-400">{r.companyName}</p>}</div> },
    { key:'phone',        label:'Phone',  render: v => <span className="font-mono text-sm">{v}</span> },
    { key:'type',         label:'Type',   render: v => <Badge type={v==='wholesale'?'amber':'blue'}>{v}</Badge> },
    { key:'creditLimit',  label:'Credit', render: (v, r) => r.type==='wholesale' ? <div><p className="text-sm font-semibold">${v?.toLocaleString()}</p><p className="text-xs text-red-500">Used: ${r.creditUsed?.toLocaleString()}</p></div> : '—' },
    { key:'totalSpent',   label:'Total Spent', render: v => <span className="font-semibold text-green-600">${v?.toFixed(2) || '0.00'}</span> },
    { key:'totalPurchases',label:'Orders', render: v => v || 0 },
    { key:'_id',          label:'Actions', render: (_, r) => (
      <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
        <button onClick={()=>openEdit(r)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
        {can('owner') && <button onClick={()=>{setSelected(r);setConfirm(true);}} className="btn-ghost py-1 px-2 text-xs text-red-400">🗑</button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${total} registered customers`}
        action={<button className="btn-primary" onClick={openCreate}>+ Add Customer</button>} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search name, company..." className="input max-w-xs" />
        <select value={typeFilter} onChange={e=>{setType(e.target.value);setPage(1);}} className="input w-40">
          <option value="">All Types</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
        <button className="btn-secondary text-sm" onClick={()=>{setSearch('');setType('');setPage(1);}}>Reset</button>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={customers} loading={loading} />
        <Pagination page={page} pages={pages} total={total} limit={20} onChange={setPage} />
      </div>

      <Modal open={modal==='form'} onClose={()=>setModal(null)} title={selected?`Edit: ${selected.name}`:'+ New Customer'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name *"><input className="input" value={form.name} onChange={e=>f('name',e.target.value)} /></Field>
          <Field label="Phone *"><input className="input" value={form.phone} onChange={e=>f('phone',e.target.value)} /></Field>
          <Field label="Phone 2"><input className="input" value={form.phone2} onChange={e=>f('phone2',e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></Field>
          <Field label="Customer Type">
            <select className="input" value={form.type} onChange={e=>f('type',e.target.value)}>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </Field>
          <Field label="Company Name"><input className="input" value={form.companyName} onChange={e=>f('companyName',e.target.value)} /></Field>
          {form.type === 'wholesale' && <>
            <Field label="Tax Number"><input className="input" value={form.taxNumber} onChange={e=>f('taxNumber',e.target.value)} /></Field>
            <Field label="Credit Limit ($)"><input className="input" type="number" value={form.creditLimit} onChange={e=>f('creditLimit',e.target.value)} /></Field>
            <Field label="Discount Rate (%)"><input className="input" type="number" value={form.discountRate} onChange={e=>f('discountRate',e.target.value)} /></Field>
            <Field label="Payment Term (days)"><input className="input" type="number" value={form.paymentTermDays} onChange={e=>f('paymentTermDays',e.target.value)} /></Field>
          </>}
          <Field label="City"><input className="input" value={form.address?.city} onChange={e=>f('address',{...form.address,city:e.target.value})} /></Field>
          <Field label="Country"><input className="input" value={form.address?.country} onChange={e=>f('address',{...form.address,country:e.target.value})} /></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input h-16 resize-none" value={form.notes} onChange={e=>f('notes',e.target.value)} /></Field></div>
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t">
          {selected && can('owner') && <button className="btn-danger text-sm" onClick={()=>setConfirm(true)}>🗑 Delete</button>}
          <div className="flex gap-3 ml-auto">
            <button className="btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?<Spinner size="sm"/>:null} Save</button>
          </div>
        </div>
      </Modal>

      <Confirm open={confirm} onClose={()=>setConfirm(false)} onConfirm={handleDelete}
        title="Delete Customer" message={`Delete "${selected?.name}"?`} />
    </div>
  );
}
