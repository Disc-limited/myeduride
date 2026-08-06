'use client';

import { useState } from 'react';
import { Bot, Sparkles, Send, X, Shield, Users, CheckCircle2, RefreshCw } from 'lucide-react';

interface MigoChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: { total: number; present: number; absent: number };
  readyCount?: number;
}

export function MigoChatModal({
  isOpen,
  onClose,
  stats = { total: 28, present: 24, absent: 4 },
  readyCount = 12,
}: MigoChatModalProps) {
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'migo',
      text: `Hello Mrs. Grace! 👋 I'm Migo, your SAVI Intelligence assistant. You currently have ${stats.present} present out of ${stats.total} students, and ${readyCount} ready for pickup. How can I help you today?`,
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    'Attendance summary today',
    'Which students are ready for pickup?',
    'View safety protocols',
    'Draft parent reminder',
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    setTimeout(() => {
      let replyText = "I've recorded that for you! Is there anything else you need assistance with?";
      const lower = text.toLowerCase();

      if (lower.includes('attendance')) {
        replyText = `📊 Today's Attendance Overview:\n- Total: ${stats.total}\n- Present: ${stats.present} (${((stats.present / (stats.total || 1)) * 100).toFixed(1)}%)\n- Absent: ${stats.absent}`;
      } else if (lower.includes('ready') || lower.includes('pickup')) {
        replyText = `🚘 Pickup Status:\n- ${readyCount} student(s) marked Ready for Pickup.\n- 7 student(s) released today.\n- You can use the "Approve All Ready" button on your dashboard to dismiss the remaining present students.`;
      } else if (lower.includes('safety') || lower.includes('protocol')) {
        replyText = `🛡️ Safety Checklist:\n1. Verify pickup escort photo and identity before release.\n2. Ensure students remain in designated classroom area.\n3. Log any sick bay or incident reports immediately.`;
      } else if (lower.includes('parent') || lower.includes('message') || lower.includes('draft')) {
        replyText = `📝 Drafted Parent Broadcast:\n"Dear Parents, Please be reminded that pickup commences at 2:00 PM today. Ensure your authorized escorts present their MyEduRide digital ID."\nWould you like me to send this via EduChart?`;
      }

      const migoMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'migo',
        text: replyText,
        time: 'Just now',
      };
      setMessages((prev) => [...prev, migoMsg]);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col h-[580px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Bot size={22} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">Migo AI Assistant</h3>
                <span className="px-2 py-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <Sparkles size={10} /> SAVI AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Classroom Safety & Operations Copilot</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              className="px-3 py-1 bg-slate-800 hover:bg-emerald-600/30 hover:border-emerald-500/50 border border-slate-700/60 text-slate-300 hover:text-emerald-300 rounded-full text-[11px] font-medium shrink-0 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/30 custom-scrollbar">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 max-w-[85%] ${
                m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {m.sender === 'migo' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  m.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none shadow-md'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-none'
                }`}
              >
                {m.text}
                <span
                  className={`block text-[9px] mt-1.5 text-right font-mono ${
                    m.sender === 'user' ? 'text-emerald-200' : 'text-slate-400'
                  }`}
                >
                  {m.time}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic">
              <RefreshCw size={14} className="animate-spin text-emerald-400" />
              <span>Migo is thinking...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Migo anything about your class..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 transition-all"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
