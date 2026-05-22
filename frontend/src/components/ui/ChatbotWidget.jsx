import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { aiAPI } from '../../api';

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function AIText({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <div key={i} className="flex gap-1.5 ml-1">
              <span className="text-amber-400 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: html.replace(/^[-•]\s*/,'') }} />
            </div>
          );
        }
        if (line.startsWith('## ') || line.startsWith('### ')) {
          return <p key={i} className="font-bold mt-2" dangerouslySetInnerHTML={{ __html: html.replace(/^#+\s*/,'') }} />;
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

const QUICK_QUESTIONS = [
  '💍 What rings are in stock?',
  '⚠️ Show low stock items',
  '💰 Most expensive products?',
  '🎁 Gift suggestion under $50',
  '📦 Wholesale products?',
  '⚖️ Heaviest silver items?',
];

export default function ChatbotWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hi! 👋 I'm your Silver Palace AI assistant.\n\nI have live access to your **inventory**, **prices**, and **sales data**.\n\nAsk me anything — I'll answer instantly!",
        isWelcome: true,
      }]);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter(m => !m.isWelcome)
        .map(m => ({ role: m.role, content: m.content }));

      const { data } = await aiAPI.assistant({
        question,
        conversationHistory: history,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      if (!open) setUnread(u => u + 1);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ ' + (err.response?.data?.message || 'Something went wrong. Please try again.'),
      }]);
      toast.error('AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUnread(0);
    setTimeout(() => {
      setMessages([{
        role: 'assistant',
        content: "Chat cleared! 👋 How can I help you?",
        isWelcome: true,
      }]);
    }, 100);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl hover:shadow-slate-400/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="AI Assistant"
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <>
            <span className="text-2xl">🤖</span>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold animate-bounce">
                {unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center text-lg flex-shrink-0">🤖</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Silver Palace AI</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-slate-400 text-xs">Live inventory access</p>
              </div>
            </div>
            <button onClick={clearChat} className="text-slate-500 hover:text-slate-300 text-xs transition-colors" title="Clear chat">
              🗑
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3">
            {/* Quick chips — only at start */}
            {messages.length <= 1 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center font-medium">Quick questions</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_QUESTIONS.map(q => (
                    <button key={q}
                      onClick={() => sendMessage(q.replace(/^[^\s]+\s/, ''))}
                      className="text-left text-xs bg-white hover:bg-amber-50 hover:border-amber-300 border rounded-lg px-2.5 py-2 text-gray-600 transition-colors leading-tight">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 self-end ${
                  msg.role === 'user' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
                }`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-white rounded-br-sm'
                    : 'bg-white border shadow-sm rounded-bl-sm text-gray-700'
                }`}>
                  {msg.role === 'user'
                    ? <p className="text-sm">{msg.content}</p>
                    : <AIText text={msg.content} />
                  }
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs flex-shrink-0">🤖</div>
                <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay:'0ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay:'150ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay:'300ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t px-3 py-3 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about products, prices…"
              className="flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <span className="text-sm">➤</span>
              }
            </button>
          </div>
        </div>
      )}
    </>
  );
}