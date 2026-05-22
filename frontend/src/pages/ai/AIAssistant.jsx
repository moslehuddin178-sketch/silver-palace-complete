import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiAPI, productAPI } from '../../api';
import { Spinner, PageHeader } from '../../components/ui';

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function AIText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-•]\s*/, '') }} />
            </div>
          );
        }
        if (line.startsWith('## ') || line.startsWith('### ')) {
          return <p key={i} className="font-bold text-gray-900 mt-3" dangerouslySetInnerHTML={{ __html: formatted.replace(/^#+\s*/, '') }} />;
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Sales Assistant
// ─────────────────────────────────────────────────────────────────────────────
function SalesAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  const QUICK = [
    'What rings do we have in stock under $50?',
    'Which products are low on stock?',
    'What are our top 5 most expensive items?',
    'Suggest a wedding gift under $100',
    'Show me all 925 silver bracelets',
    'What necklaces are available for wholesale?',
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question) return;
    setInput('');
    setLoading(true);
    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const { data } = await aiAPI.assistant({ question, conversationHistory: history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI request failed');
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🤖</div>
            <p className="font-semibold text-gray-800 text-lg">AI Sales Assistant</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">Ask anything about your inventory, prices, or get product recommendations</p>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {QUICK.map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-left text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
              msg.role === 'user' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
            }`}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-amber-500 text-white rounded-tr-sm'
                : 'bg-white border shadow-sm rounded-tl-sm'
            }`}>
              {msg.role === 'user'
                ? <p className="text-sm">{msg.content}</p>
                : <AIText text={msg.content} />
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <div className="bg-white border shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-sm text-gray-400">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about inventory, prices, recommendations…"
            className="input flex-1 text-sm" disabled={loading} />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="btn-primary px-5 disabled:opacity-40">
            {loading ? <Spinner size="sm" /> : '➤'}
          </button>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="btn-secondary px-3 text-xs">
              🗑 Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Product Description Generator
// ─────────────────────────────────────────────────────────────────────────────
function DescriptionGenerator() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('');
  const [tone, setTone]         = useState('professional');
  const [language, setLanguage] = useState('english');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [copied, setCopied]     = useState('');

  useEffect(() => {
    productAPI.list({ limit: 200 })
      .then(r => setProducts(r.data.data || []))
      .catch(() => {});
  }, []);

  const generate = async () => {
    if (!selected) return toast.error('Select a product first');
    setLoading(true); setResult(null);
    try {
      const { data } = await aiAPI.describe({ productId: selected, tone, language });
      setResult(data);
      toast.success('Description generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally { setLoading(false); }
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
    toast.success('Copied!');
  };

  const selectedProduct = products.find(p => p._id === selected);

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: controls */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="label">Select Product</label>
            <select className="input text-sm" value={selected}
              onChange={e => { setSelected(e.target.value); setResult(null); }}>
              <option value="">Choose a product…</option>
              {products.map(p => (
                <option key={p._id} value={p._id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-amber-800">{selectedProduct.name}</p>
              <p className="text-amber-600">{selectedProduct.sku} · {selectedProduct.purity} · {selectedProduct.weightGram}g</p>
              <p className="text-amber-600 capitalize">{selectedProduct.category} · {selectedProduct.finish}</p>
            </div>
          )}

          <div>
            <label className="label">Tone</label>
            <select className="input text-sm" value={tone} onChange={e => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="luxury">Luxury / Premium</option>
              <option value="casual">Casual & Friendly</option>
              <option value="poetic">Poetic & Artistic</option>
            </select>
          </div>

          <div>
            <label className="label">Language</label>
            <select className="input text-sm" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="english">English</option>
              <option value="turkish">Turkish</option>
              <option value="arabic">Arabic</option>
              <option value="german">German</option>
              <option value="french">French</option>
            </select>
          </div>

          <button onClick={generate} disabled={loading || !selected}
            className="btn-primary w-full disabled:opacity-40">
            {loading ? <><Spinner size="sm" /> Generating…</> : '✨ Generate Description'}
          </button>
        </div>

        {/* Right: result */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Spinner size="lg" />
              <p className="text-gray-400 text-sm">Claude is crafting your description…</p>
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-3">
              <p className="text-5xl">✍️</p>
              <p className="text-sm">Select a product and click Generate</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{result.sku} — {result.name}</p>
                <button onClick={() => {
                  const full = `${result.data.tagline}\n\n${result.data.description}\n\nFeatures:\n${result.data.features?.map(f => `• ${f}`).join('\n')}\n\nCare: ${result.data.careInstructions}`;
                  copyText(full, 'all');
                }} className="btn-secondary text-xs">
                  {copied === 'all' ? '✅ Copied!' : '📋 Copy All'}
                </button>
              </div>

              <div className="card p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Tagline</span>
                  <button onClick={() => copyText(result.data.tagline, 'tag')} className="text-xs text-gray-400 hover:text-gray-600">
                    {copied === 'tag' ? '✅' : '📋'} Copy
                  </button>
                </div>
                <p className="text-gray-800 font-medium italic">"{result.data.tagline}"</p>
              </div>

              <div className="card p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Main Description</span>
                  <button onClick={() => copyText(result.data.description, 'desc')} className="text-xs text-gray-400 hover:text-gray-600">
                    {copied === 'desc' ? '✅' : '📋'} Copy
                  </button>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{result.data.description}</p>
              </div>

              {result.data.features?.length > 0 && (
                <div className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Key Features</span>
                    <button onClick={() => copyText(result.data.features.map(f => `• ${f}`).join('\n'), 'feat')} className="text-xs text-gray-400 hover:text-gray-600">
                      {copied === 'feat' ? '✅' : '📋'} Copy
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {result.data.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-amber-500 flex-shrink-0">✦</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.data.careInstructions && (
                <div className="card p-4 bg-blue-50 border-blue-100">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide block mb-2">Care Instructions</span>
                  <p className="text-sm text-blue-800">{result.data.careInstructions}</p>
                </div>
              )}

              <button onClick={generate} className="btn-secondary text-sm w-full">
                🔄 Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Business Insights
// ─────────────────────────────────────────────────────────────────────────────
function BusinessInsights() {
  const [period, setPeriod]     = useState('30');
  const [question, setQuestion] = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);

  const QUICK_QUESTIONS = [
    'Give me a full business overview',
    'What are my best selling products?',
    'How are retail vs wholesale sales performing?',
    'What should I restock urgently?',
    'Which payment methods are customers using most?',
    'What is my revenue trend?',
  ];

  const getInsights = async (q) => {
    const ask = (q || question || 'Give me a full business overview and key insights').trim();
    setLoading(true); setResult(null);
    try {
      const { data } = await aiAPI.insights({ question: ask, period });
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Analysis failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-5 overflow-y-auto">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Analysis Period</label>
          <select className="input w-40" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label">Custom Question (optional)</label>
          <input className="input text-sm" value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && getInsights()}
            placeholder="e.g. What's my best day of the week?" />
        </div>
        <button onClick={() => getInsights()} disabled={loading}
          className="btn-primary disabled:opacity-40">
          {loading ? <><Spinner size="sm" /> Analyzing…</> : '🧠 Analyze'}
        </button>
      </div>

      {!result && !loading && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Analysis</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => getInsights(q)}
                className="text-left text-sm bg-white hover:bg-slate-50 border hover:border-slate-300 rounded-xl px-4 py-3 text-gray-700 transition-all hover:shadow-sm">
                <span className="text-base mr-2">💡</span>{q}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p className="text-gray-400 text-sm">Claude is analyzing your business data…</p>
          <p className="text-gray-300 text-xs">This may take a few seconds</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label:'Revenue',     value:`$${result.rawData.revenue?.toFixed(2)}`,  color:'text-green-600',  bg:'bg-green-50'  },
              { label:'Sales',       value:result.rawData.sales,                       color:'text-blue-600',   bg:'bg-blue-50'   },
              { label:'Avg Order',   value:`$${result.rawData.avgOrder?.toFixed(2)}`, color:'text-amber-600',  bg:'bg-amber-50'  },
              { label:'Low Stock',   value:result.rawData.lowStock,                   color:'text-orange-600', bg:'bg-orange-50' },
              { label:'Out of Stock',value:result.rawData.outOfStock,                 color:'text-red-600',    bg:'bg-red-50'    },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-sm">🧠</div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Claude AI Analysis</p>
                  <p className="text-xs text-gray-400">{result.period}</p>
                </div>
              </div>
              <button onClick={() => navigator.clipboard.writeText(result.insights).then(() => toast.success('Copied!'))}
                className="btn-secondary text-xs">📋 Copy</button>
            </div>
            <AIText text={result.insights} />
          </div>

          <button onClick={() => getInsights()} className="btn-secondary text-sm">
            🔄 Refresh Analysis
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AI HUB PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [tab, setTab] = useState('assistant');

  const TABS = [
    { key:'assistant', icon:'🤖', label:'Sales Assistant',      sub:'Ask about inventory & prices'  },
    { key:'describe',  icon:'✍️',  label:'Description Generator',sub:'Auto-write product listings'   },
    { key:'insights',  icon:'🧠', label:'Business Insights',    sub:'AI analysis of your sales'     },
  ];

  return (
    <div className="flex flex-col h-full" style={{ height:'calc(100vh - 8rem)' }}>
      <PageHeader
        title="AI Assistant"
        subtitle="Powered by Claude · Your intelligent jewelry business partner"
      />

      <div className="flex gap-3 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
              tab === t.key
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                : 'bg-white text-gray-600 border-gray-200 hover:border-slate-300 hover:shadow-sm'
            }`}>
            <span className="text-xl">{t.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${tab===t.key?'text-white':'text-gray-800'}`}>{t.label}</p>
              <p className={`text-xs ${tab===t.key?'text-white/60':'text-gray-400'}`}>{t.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 rounded-full px-3 py-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-purple-700">Powered by Claude Sonnet</span>
        </div>
        <span className="text-xs text-gray-400">Live inventory context · Real-time analysis</span>
      </div>

      <div className="card flex-1 overflow-hidden flex flex-col">
        {tab === 'assistant' && <SalesAssistant />}
        {tab === 'describe'  && <DescriptionGenerator />}
        {tab === 'insights'  && <BusinessInsights />}
      </div>
    </div>
  );
}