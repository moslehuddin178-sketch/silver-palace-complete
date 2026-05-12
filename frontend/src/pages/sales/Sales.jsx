import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { saleAPI } from '../../api';
import { Table, Pagination, PageHeader, StatusBadge, Badge, Modal, Spinner } from '../../components/ui';

export default function Sales() {
  const navigate = useNavigate();
  const [sales, setSales]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ saleType:'', status:'', paymentMethod:'', from:'', to:'' });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDL] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...filters, page, limit: 20 };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    saleAPI.list(params)
      .then(r => { setSales(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load sales'))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (sale) => {
    setDL(true); setDetail({});
    try { const r = await saleAPI.get(sale._id); setDetail(r.data.data); }
    catch { toast.error('Failed to load sale'); setDetail(null); }
    finally { setDL(false); }
  };

  const sf = (k, v) => { setFilters(f => ({...f,[k]:v})); setPage(1); };

  const columns = [
    { key:'invoiceNo',     label:'Invoice',  render: v => <span className="font-mono text-xs font-semibold text-amber-600">{v}</span> },
    { key:'saleType',      label:'Type',     render: v => <Badge type={v==='wholesale'?'amber':'blue'}>{v}</Badge> },
    { key:'customerSnapshot', label:'Customer', render: (v, r) => <p className="text-sm">{r.isWalkIn ? 'Walk-in' : v?.name || '—'}</p> },
    { key:'items',         label:'Items',    render: (_, r) => r.items?.length || 0 },
    { key:'totalWeightGram', label:'Weight', render: v => <span className="font-mono text-sm">{v?.toFixed(1)}g</span> },
    { key:'totalAmount',   label:'Total',    render: v => <span className="font-semibold text-green-600">${v?.toFixed(2)}</span> },
    { key:'paymentMethod', label:'Payment',  render: v => <span className="capitalize text-sm">{v?.replace('_',' ')}</span> },
    { key:'status',        label:'Status',   render: v => <StatusBadge status={v} /> },
    { key:'cashier',       label:'Cashier',  render: (_, r) => <span className="text-sm">{r.cashier?.name || '—'}</span> },
    { key:'createdAt',     label:'Date',     render: v => <span className="text-xs text-gray-400">{new Date(v).toLocaleString()}</span> },
  ];

  return (
    <div>
      <PageHeader title="Sales History" subtitle={`${total} total transactions`} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <select className="input w-36" value={filters.saleType} onChange={e=>sf('saleType',e.target.value)}>
          <option value="">All Types</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
        <select className="input w-36" value={filters.status} onChange={e=>sf('status',e.target.value)}>
          <option value="">All Status</option>
          {['completed','pending','refunded','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-40" value={filters.paymentMethod} onChange={e=>sf('paymentMethod',e.target.value)}>
          <option value="">All Payments</option>
          {['cash','card','bank_transfer','credit','mixed'].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
        </select>
        <input type="date" className="input w-40" value={filters.from} onChange={e=>sf('from',e.target.value)} />
        <input type="date" className="input w-40" value={filters.to}   onChange={e=>sf('to',e.target.value)} />
        <button className="btn-secondary text-sm" onClick={()=>{setFilters({saleType:'',status:'',paymentMethod:'',from:'',to:''});setPage(1);}}>Reset</button>
      </div>

      <div className="card overflow-hidden">
        <Table columns={columns} data={sales} loading={loading} onRowClick={openDetail} />
        <Pagination page={page} pages={pages} total={total} limit={20} onChange={setPage} />
      </div>

      {/* Detail Modal */}
      <Modal open={!!detail || detailLoading} onClose={()=>setDetail(null)} title={`Invoice: ${detail?.invoiceNo || '...'}`} size="lg">
        {detailLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
         detail && <SaleDetail sale={detail} />}
      </Modal>
    </div>
  );
}

function SaleDetail({ sale }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Type',    <Badge type={sale.saleType==='wholesale'?'amber':'blue'}>{sale.saleType}</Badge>],
          ['Status',  <StatusBadge status={sale.status} />],
          ['Payment', <span className="capitalize text-sm">{sale.paymentMethod?.replace('_',' ')}</span>],
          ['Customer', sale.isWalkIn ? 'Walk-in' : sale.customer?.name || sale.customerSnapshot?.name || '—'],
          ['Cashier',  sale.cashier?.name || '—'],
          ['Date',     new Date(sale.createdAt).toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">{k}</p>
            <p className="font-medium text-gray-900 text-sm">{v}</p>
          </div>
        ))}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="th">Product</th><th className="th">Weight</th><th className="th">Qty</th><th className="th">Unit Price</th><th className="th">Disc</th><th className="th">Total</th></tr></thead>
          <tbody className="divide-y">
            {sale.items?.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="td"><p className="font-medium">{item.name}</p><p className="text-xs text-gray-400 font-mono">{item.sku} · {item.purity}</p></td>
                <td className="td font-mono">{item.weightGram}g</td>
                <td className="td text-center font-semibold">{item.quantity}</td>
                <td className="td font-mono">${item.unitPrice?.toFixed(2)}</td>
                <td className="td text-center">{item.discount ? `${item.discount}%` : '—'}</td>
                <td className="td font-bold text-green-600">${item.totalPrice?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
        {[
          ['Subtotal',      `$${sale.subtotal?.toFixed(2)}`],
          sale.discountAmount > 0 && [`Discount (${sale.globalDiscount}%)`, `-$${sale.discountAmount?.toFixed(2)}`],
          sale.taxAmount > 0 && ['Tax', `$${sale.taxAmount?.toFixed(2)}`],
          ['TOTAL',         `$${sale.totalAmount?.toFixed(2)}`],
          ['Paid',          `$${sale.amountPaid?.toFixed(2)}`],
          sale.changeGiven > 0 && ['Change', `$${sale.changeGiven?.toFixed(2)}`],
          sale.creditAmount > 0 && ['Credit', `$${sale.creditAmount?.toFixed(2)}`],
          ['Total Weight',  `${sale.totalWeightGram?.toFixed(2)}g`],
          ['Silver Rate',   `$${sale.silverGramPrice}/g at time of sale`],
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} className={`flex justify-between ${k==='TOTAL'?'font-bold text-base border-t pt-2':''}`}>
            <span className="text-gray-500">{k}</span>
            <span className={`font-medium ${k==='TOTAL'?'text-green-600':''}`}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
