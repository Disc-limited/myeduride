// @ts-nocheck
'use client';

import { useState } from 'react';
import { Code2, Key, Copy, Check, ShieldCheck, RefreshCw, Radio, Terminal } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolApiSettingsPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [apiKey, setApiKey] = useState('eduride_live_sk_89210984128941098412');
  const [webhookUrl, setWebhookUrl] = useState('https://school-gateway.edu.ng/api/eduride-webhook');

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success('API Secret Key copied to clipboard!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Webhook endpoint configuration updated!');
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#07132B] via-[#0B1E36] to-[#0A1633] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-[11px] border border-amber-400/30 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 size={13} /> Developer API & Gate Terminals
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            School API Keys & Webhook Endpoints
          </h1>
          <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium">
            Programmatic access keys for turnstiles, gate barcode scanner devices, automated dismissal webhooks, and SIS synchronization.
          </p>
        </div>
      </div>

      {/* API Key Box */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <Key size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Live Gate Terminal API Key</h3>
            <p className="text-xs text-slate-500 font-medium">Use this bearer token to authenticate external scanner hardware with `/api/gate/scan`.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 text-white font-mono text-xs flex items-center justify-between gap-3">
          <span className="truncate">{apiKey}</span>
          <button
            type="button"
            onClick={copyKey}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
          </button>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Radio size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Real-Time Event Webhook</h3>
            <p className="text-xs text-slate-500 font-medium">Receive HTTP POST payloads when students check in, are marked ready, or depart.</p>
          </div>
        </div>

        <form onSubmit={handleSaveWebhook} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Webhook Endpoint URL *</label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Save Webhook Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
