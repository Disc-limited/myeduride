// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Building,
  Shield,
  Search,
  CheckCheck,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface EscortChatViewProps {
  liveDashboardData: any;
}

export default function EscortChatView({ liveDashboardData }: EscortChatViewProps) {
  const [activeChannel, setActiveChannel] = useState<'parents' | 'school' | 'cityManager'>('parents');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<any[]>([
    { id: '1', sender: 'Mrs. Adebayo (David\'s Mother)', text: 'Good morning Escort, David is waiting at the front gate.', time: '07:10 AM', isMe: false, channel: 'parents' },
    { id: '2', sender: 'You', text: 'Good morning! Arriving at Admiralty Way stop in 3 minutes.', time: '07:12 AM', isMe: true, channel: 'parents' },
    { id: '3', sender: 'School Security Desk', text: 'Gate A ready for morning transit arrivals.', time: '07:00 AM', isMe: false, channel: 'school' },
    { id: '4', sender: 'City Manager Operations', text: 'Route RT-01 tracking active and nominal.', time: '06:45 AM', isMe: false, channel: 'cityManager' },
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const newMsg = {
      id: String(Date.now()),
      sender: 'You',
      text: messageInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      channel: activeChannel,
    };

    setMessages((prev) => [...prev, newMsg]);
    setMessageInput('');
    toast.success('Message sent');
  };

  const filteredMessages = messages.filter((m) => m.channel === activeChannel);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
      {/* 1. CHANNEL SELECTOR SIDEBAR */}
      <div className="w-full md:w-72 border-r border-slate-100 bg-slate-50 p-4 space-y-3">
        <h3 className="font-black text-sm text-slate-900 px-2">Communications Hub</h3>

        <div className="space-y-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveChannel('parents')}
            className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
              activeChannel === 'parents' ? 'bg-white shadow-xs text-emerald-800 font-extrabold border border-slate-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users size={16} className="text-emerald-600" />
              <span>Assigned Parents</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel('school')}
            className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
              activeChannel === 'school' ? 'bg-white shadow-xs text-blue-800 font-extrabold border border-slate-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building size={16} className="text-blue-600" />
              <span>School Admin Desk</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel('cityManager')}
            className={`w-full p-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
              activeChannel === 'cityManager' ? 'bg-white shadow-xs text-purple-800 font-extrabold border border-slate-200' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-purple-600" />
              <span>City Manager Dispatch</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. CHAT CONVERSATION AREA */}
      <div className="flex-1 flex flex-col justify-between bg-white">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
              💬
            </div>
            <div>
              <h4 className="font-black text-xs text-slate-900 capitalize">
                {activeChannel === 'parents' ? 'Route Parents Channel' : activeChannel === 'school' ? 'School Administrator Dispatch' : 'City Manager Operations'}
              </h4>
              <p className="text-[10px] text-slate-400">Direct encrypted channel</p>
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-3.5 flex-1 max-h-[420px]">
          {filteredMessages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{msg.sender}</span>
              <div
                className={`max-w-md p-3.5 rounded-2xl text-xs font-medium leading-relaxed ${
                  msg.isMe
                    ? 'bg-emerald-600 text-white rounded-tr-xs shadow-xs'
                    : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your message to channel..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <button
            type="submit"
            className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition-all shrink-0"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
