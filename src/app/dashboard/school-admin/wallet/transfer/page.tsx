'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  ArrowLeft,
  Send,
  CheckCircle2,
  ShieldCheck,
  Search,
  User,
  Car,
  X,
  AlertCircle,
  Wallet,
  Check,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface RecipientItem {
  id: string;
  user_id?: string | null;
  name: string;
  code: string;
  phone: string;
  email?: string;
  type: 'escort' | 'driver' | 'staff';
  badge: string;
  status: string;
  verified: boolean;
  vehicle_info?: string | null;
}

export default function WalletTransferPage() {
  const [recipientType, setRecipientType] = useState<'escort' | 'driver'>('escort');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipientItem[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Form Fields
  const [amount, setAmount] = useState('');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(false);

  // School Wallet State
  const [availableBalanceNgn, setAvailableBalanceNgn] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState<string>('School');
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Success Confirmation State
  const [successReceipt, setSuccessReceipt] = useState<{
    reference: string;
    amount: number;
    recipientName: string;
    recipientCode: string;
    newBalance: number;
  } | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch live school wallet balance
  const fetchWallet = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const res = await fetch('/api/schools/wallet', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.wallet) {
        setAvailableBalanceNgn(json.wallet.available_balance_ngn);
        setSchoolName(json.wallet.school_name || 'School');
      }
    } catch (err) {
      console.warn('[WalletTransferPage] Error loading wallet balance:', err);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // 2. Query approved recipients from the database
  const searchRecipients = useCallback(async (query: string, type: 'escort' | 'driver') => {
    try {
      setIsSearching(true);
      const params = new URLSearchParams({
        type,
        q: query.trim(),
      });
      const res = await fetch(`/api/schools/wallet/recipients?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.recipients)) {
        setSearchResults(json.recipients);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('[WalletTransferPage] Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Trigger search on input changes or type switch
  useEffect(() => {
    if (selectedRecipient) return; // Don't search if a recipient is already locked in
    const timer = setTimeout(() => {
      searchRecipients(searchQuery, recipientType);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, recipientType, selectedRecipient, searchRecipients]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Classification Switch
  const handleTypeChange = (type: 'escort' | 'driver') => {
    setRecipientType(type);
    setSelectedRecipient(null);
    setSearchQuery('');
    setShowDropdown(true);
  };

  // Handle Selecting an Approved Recipient
  const handleSelectRecipient = (item: RecipientItem) => {
    setSelectedRecipient(item);
    setSearchQuery(`${item.name} (${item.code})`);
    setShowDropdown(false);
  };

  // Handle Clearing the Selected Recipient
  const handleClearRecipient = () => {
    setSelectedRecipient(null);
    setSearchQuery('');
    setTimeout(() => {
      searchInputRef.current?.focus();
      setShowDropdown(true);
    }, 50);
  };

  // Handle Transfer Form Submission
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRecipient) {
      toast.error('Please select an accredited escort or driver from the database search.');
      searchInputRef.current?.focus();
      setShowDropdown(true);
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      toast.error('Minimum transfer amount is ₦100');
      return;
    }

    if (availableBalanceNgn !== null && numericAmount > availableBalanceNgn) {
      toast.error(
        `Insufficient funds. Available wallet balance is ₦${availableBalanceNgn.toLocaleString()}`
      );
      return;
    }

    setLoading(true);
    const toastId = toast.loading(`Authorizing ₦${numericAmount.toLocaleString()} disbursement...`);

    try {
      const res = await fetch('/api/schools/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selectedRecipient.id,
          recipient_name: selectedRecipient.name,
          recipient_code: selectedRecipient.code,
          recipient_type: selectedRecipient.type,
          recipient_phone: selectedRecipient.phone,
          amount: numericAmount,
          narrative: narrative.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to authorize fund transfer');
      }

      toast.success(`₦${numericAmount.toLocaleString()} disbursed to ${selectedRecipient.name}!`, {
        id: toastId,
      });

      setSuccessReceipt({
        reference: json.reference,
        amount: numericAmount,
        recipientName: selectedRecipient.name,
        recipientCode: selectedRecipient.code,
        newBalance:
          json.balance_after_ngn ?? (availableBalanceNgn ? availableBalanceNgn - numericAmount : 0),
      });

      // Update local wallet balance
      if (json.balance_after_ngn !== undefined) {
        setAvailableBalanceNgn(json.balance_after_ngn);
      } else if (availableBalanceNgn !== null) {
        setAvailableBalanceNgn(availableBalanceNgn - numericAmount);
      }
    } catch (err: any) {
      console.error('[WalletTransferPage] Transfer failed:', err);
      toast.error(err.message || 'Transfer failed. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccessReceipt(null);
    setSelectedRecipient(null);
    setSearchQuery('');
    setAmount('');
    setNarrative('');
    fetchWallet();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 font-sans text-slate-800 md:p-6">
      {/* Back Button */}
      <Link
        href="/dashboard/school-admin/wallet"
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Back to Wallet Overview
      </Link>

      {/* Main Card */}
      <div className="shadow-xs space-y-6 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="shadow-xs flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 font-black text-emerald-800">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Wallet Fund Transfer</h2>
              <p className="text-xs font-medium text-slate-500">
                Disburse payments to school escorts, drivers, and safety service personnel.
              </p>
            </div>
          </div>

          {/* Balance Badge */}
          <div className="flex items-center gap-2.5 self-start rounded-2xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2 sm:self-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Wallet size={16} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                Available Wallet Balance
              </div>
              <div className="font-mono text-sm font-black text-emerald-950">
                {loadingWallet
                  ? 'Loading balance...'
                  : availableBalanceNgn !== null
                    ? `₦${availableBalanceNgn.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '₦0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Success Modal / View */}
        {successReceipt ? (
          <div className="animate-in fade-in space-y-4 rounded-3xl border-2 border-emerald-500/40 bg-emerald-50/70 p-6 text-center duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Disbursement Successful!</h3>
              <p className="mt-1 text-xs text-slate-600">
                ₦{successReceipt.amount.toLocaleString()} was successfully disbursed from{' '}
                {schoolName}&apos;s institutional wallet.
              </p>
            </div>

            <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-emerald-100 bg-white p-4 text-left text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-500">Recipient Name:</span>
                <span className="font-bold text-slate-900">{successReceipt.recipientName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-500">Escort / Driver Code:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {successReceipt.recipientCode}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium text-slate-500">Audit Reference:</span>
                <span className="font-mono text-[11px] font-bold text-slate-800">
                  {successReceipt.reference}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-medium text-slate-500">Remaining Wallet Balance:</span>
                <span className="font-mono font-black text-slate-900">
                  ₦
                  {successReceipt.newBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={resetForm}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800 sm:w-auto"
              >
                <RotateCcw size={14} /> Make Another Transfer
              </button>
              <Link
                href="/dashboard/school-admin/wallet"
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
              >
                <Receipt size={14} /> View Wallet Ledger
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleTransfer} className="space-y-5 text-xs">
            {/* Recipient Classification Switcher */}
            <div>
              <label className="mb-1.5 block font-bold text-slate-700">
                Recipient Classification
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('escort')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-bold transition-all ${
                    recipientType === 'escort'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>School / Platform Escort</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('driver')}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-bold transition-all ${
                    recipientType === 'driver'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Car size={14} />
                  <span>Transport Driver / Staff</span>
                </button>
              </div>
            </div>

            {/* Recipient Autocomplete Input */}
            <div ref={searchContainerRef} className="relative">
              <label className="mb-1 flex items-center justify-between font-bold text-slate-700">
                <span>
                  Recipient Name or Phone / Escort Code <span className="text-rose-500">*</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
                  <ShieldCheck size={12} /> Database Verified Only
                </span>
              </label>

              {/* Locked Verified Recipient Badge */}
              {selectedRecipient ? (
                <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 p-3.5 duration-150">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-black text-white">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {selectedRecipient.name}
                        </span>
                        <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-900">
                          {selectedRecipient.code}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                        <span>{selectedRecipient.phone}</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-700">
                          {selectedRecipient.badge}
                        </span>
                        {selectedRecipient.vehicle_info && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500">{selectedRecipient.vehicle_info}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearRecipient}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <X size={12} />
                    <span>Change</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    required
                    placeholder={
                      recipientType === 'escort'
                        ? 'Search approved escort by name, phone, or escort code (e.g. Davwaro, ESC-6004)...'
                        : 'Search assigned driver or staff by name, phone, or license...'
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="outline-hidden w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 font-bold text-slate-900 transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={16} />
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Autocomplete Dropdown List */}
              {showDropdown && !selectedRecipient && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 right-0 z-50 mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl duration-150">
                  <div className="flex items-center justify-between bg-slate-50/80 p-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>
                      {recipientType === 'escort'
                        ? 'Approved School Escorts'
                        : 'Transport Drivers & Staff'}
                    </span>
                    {isSearching && (
                      <span className="animate-pulse font-bold text-emerald-600">
                        Searching database...
                      </span>
                    )}
                  </div>

                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={`${item.type}-${item.id}-${item.code}`}
                        type="button"
                        onClick={() => handleSelectRecipient(item)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-emerald-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-700 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-800">
                            {item.type === 'escort' ? <ShieldCheck size={18} /> : <Car size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 transition-colors group-hover:text-emerald-950">
                                {item.name}
                              </span>
                              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                                {item.code}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                              <span>{item.phone}</span>
                              {item.vehicle_info && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-slate-600">
                                    {item.vehicle_info}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            <Check size={11} /> Vetted
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="space-y-1.5 p-6 text-center">
                      <AlertCircle size={24} className="mx-auto text-amber-500/80" />
                      <p className="text-xs font-bold text-slate-800">
                        No approved {recipientType === 'escort' ? 'escorts' : 'drivers'} found
                      </p>
                      <p className="mx-auto max-w-xs text-[11px] text-slate-500">
                        Only personnel vetted and approved by the City Manager can be selected for
                        wallet disbursements.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Amount to Disburse */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Amount to Disburse (₦) <span className="text-rose-500">*</span>
                </label>
                {availableBalanceNgn !== null && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(availableBalanceNgn))}
                    className="cursor-pointer text-[10px] font-extrabold text-emerald-700 hover:text-emerald-900"
                  >
                    Max (₦{availableBalanceNgn.toLocaleString()})
                  </button>
                )}
              </div>

              <input
                type="number"
                required
                min="100"
                placeholder="50,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="outline-hidden w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base font-black text-emerald-700 transition-all placeholder:text-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              />

              {/* Quick Amount Presets */}
              <div className="mt-2 flex flex-wrap gap-2">
                {[5000, 10000, 25000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
                      amount === String(preset)
                        ? 'shadow-xs bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ₦{preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Narrative */}
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                Payment Narrative / Reference
              </label>
              <input
                type="text"
                placeholder="e.g. Week 4 Transport Service Stipend"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                className="outline-hidden w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-900 transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedRecipient || !amount}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#00A859] py-3.5 text-xs font-black text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} />
              <span>
                {loading
                  ? 'Authorizing Transfer...'
                  : selectedRecipient && amount
                    ? `Authorize ₦${Number(amount || 0).toLocaleString()} Transfer to ${selectedRecipient.name}`
                    : 'Authorize Fund Transfer'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
