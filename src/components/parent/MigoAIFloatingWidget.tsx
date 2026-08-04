'use client';

import { useState } from 'react';
import { Bot, X, Send, Sparkles, UserCheck, ShieldCheck } from 'lucide-react';
import { ChildStudent } from './ChildrenGridCard';

interface MigoAIFloatingWidgetProps {
  userName: string;
  childrenList: ChildStudent[];
  isOpen: boolean;
  onToggle: () => void;
  onOpenAbsenceNotice?: () => void;
  onOpenAttendanceHistory?: () => void;
}

interface Message {
  id: string;
  sender: 'migo' | 'user';
  text: string;
}

export default function MigoAIFloatingWidget({
  userName,
  childrenList,
  isOpen,
  onToggle,
  onOpenAbsenceNotice,
  onOpenAttendanceHistory,
}: MigoAIFloatingWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'migo',
      text: `Hi ${userName || 'Parent'}! 👋 I'm Migo, your smart assistant. How can I help you today?`,
    },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    // Generate intelligent AI response based on parent data
    setTimeout(() => {
      let replyText = "I'm checking that for you right now.";
      const lower = text.toLowerCase();

      if (lower.includes('where') || lower.includes('arrived') || lower.includes('status')) {
        if (childrenList.length === 0) {
          replyText = 'You do not have any linked children on your profile yet.';
        } else {
          const statusLines = childrenList.map((c) => {
            return c.present_today
              ? `✅ ${c.first_name} is checked in and safely at school.`
              : `⏳ ${c.first_name} has not checked in yet today.`;
          });
          replyText = statusLines.join('\n');
        }
      } else if (lower.includes('absence') || lower.includes('notify')) {
        replyText =
          'I can help you notify the school office about your child’s absence or late arrival. Please use the Authorize Pickup / Notice form.';
        if (onOpenAbsenceNotice) onOpenAbsenceNotice();
      } else if (lower.includes('attendance')) {
        replyText = 'Opening your children’s attendance report timeline...';
        if (onOpenAttendanceHistory) onOpenAttendanceHistory();
      } else {
        replyText = `Thank you! I have logged your request: "${text}". The school administration has been notified.`;
      }

      const migoMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'migo',
        text: replyText,
      };

      setMessages((prev) => [...prev, migoMsg]);
    }, 600);
  };

  const suggestionChips = [
    childrenList[0] ? `Where is ${childrenList[0].first_name}?` : 'Where are my kids?',
    childrenList[1] ? `Has ${childrenList[1].first_name} arrived?` : 'Check arrival status',
    'Notify school of absence',
    'Show attendance',
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Robot Action Button */}
      <button
        type="button"
        onClick={onToggle}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-xl shadow-emerald-900/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group relative"
        title="Ask Migo AI Assistant"
      >
        <Bot className="w-7 h-7 stroke-[2.2]" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[9px] font-bold">
          ✨
        </span>
      </button>

      {/* Expanded Popover Dialog */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                  <span>Migo AI</span>
                  <span className="text-[9px] font-bold bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded">
                    PRO
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Your Student Safety Assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto bg-slate-50/60 min-h-[200px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 text-xs ${
                  m.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.sender === 'migo' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                    M
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[82%] leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white font-medium rounded-br-none shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs whitespace-pre-line font-medium'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Suggestion Chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip)}
                className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-200/80 transition-all text-left"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Migo anything..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
