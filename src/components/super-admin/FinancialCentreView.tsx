'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Users,
  Shield,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Landmark,
  FileText,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface FinancialSummary {
  total_available_ngn: number;
  total_pending_ngn: number;
  total_deposits_ngn: number;
  total_platform_revenue_ngn: number;
  total_wallets_count: number;
  total_transactions_count: number;
}

interface WalletItem {
  id: string;
  user_id: string | null;
  entity_type: string;
  school_id: string | null;
  owner_name: string;
  owner_email: string | null;
  owner_phone: string | null;
  school_name: string | null;
  available_balance_ngn: number;
  reserved_balance_ngn: number;
  pending_earnings_ngn: number;
  currency: string;
  virtual_account_number: string | null;
  virtual_bank_name: string | null;
  virtual_account_name: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  payout_bank_name: string | null;
  status: string;
  updated_at: string;
}

interface TransactionItem {
  id: string;
  wallet_id: string;
  transaction_type: string;
  channel: string;
  amount_ngn: number;
  balance_before_ngn: number;
  balance_after_ngn: number;
  reference: string;
  status: string;
  description: string;
  created_at: string;
  wallet_entity_type: string;
  wallet_owner_name: string;
  wallet_owner_email: string | null;
  metadata?: any;
}

export default function FinancialCentreView() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Navigation tab: 'transactions' | 'wallets'
  const [activeTab, setActiveTab] = useState<'transactions' | 'wallets'>('transactions');

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [selectedType, setSelectedType] = useState('all'); // CREDIT / DEBIT / all
  const [selectedChannel, setSelectedChannel] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/super-admin/financials?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load financial records');
      }

      setSummary(data.summary || null);
      setWallets(data.wallets || []);
      setTransactions(data.transactions || []);
      if (isRefresh) toast.success('Financial ledger updated');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error loading financial center');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.reference?.toLowerCase().includes(q) ||
        t.wallet_owner_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.channel?.toLowerCase().includes(q);

      const matchesEntity = selectedEntity === 'all' || t.wallet_entity_type === selectedEntity;
      const matchesType = selectedType === 'all' || t.transaction_type === selectedType;
      const matchesChannel =
        selectedChannel === 'all' ||
        (selectedChannel === 'seerbit' && t.channel?.toLowerCase().includes('seerbit')) ||
        (selectedChannel === 'escrow' && t.channel?.toLowerCase().includes('escrow')) ||
        (selectedChannel === 'commission' && t.channel?.toLowerCase().includes('commission')) ||
        (selectedChannel === 'stipend' && t.channel?.toLowerCase().includes('stipend'));

      return matchesSearch && matchesEntity && matchesType && matchesChannel;
    });
  }, [transactions, searchQuery, selectedEntity, selectedType, selectedChannel]);

  // Filtered wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.owner_name?.toLowerCase().includes(q) ||
        w.owner_email?.toLowerCase().includes(q) ||
        w.virtual_account_number?.includes(q) ||
        w.payout_account_number?.includes(q) ||
        w.school_name?.toLowerCase().includes(q);

      const matchesEntity = selectedEntity === 'all' || w.entity_type === selectedEntity;
      return matchesSearch && matchesEntity;
    });
  }, [wallets, searchQuery, selectedEntity]);

  // Reset pagination on filter or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedEntity, selectedType, selectedChannel]);

  // Pagination for Transactions
  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const txStartIndex = (currentPage - 1) * pageSize;
  const txEndIndex = Math.min(txStartIndex + pageSize, filteredTransactions.length);
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(txStartIndex, txEndIndex);
  }, [filteredTransactions, txStartIndex, txEndIndex]);

  // Pagination for Wallets
  const totalWalletPages = Math.max(1, Math.ceil(filteredWallets.length / pageSize));
  const walletStartIndex = (currentPage - 1) * pageSize;
  const walletEndIndex = Math.min(walletStartIndex + pageSize, filteredWallets.length);
  const paginatedWallets = useMemo(() => {
    return filteredWallets.slice(walletStartIndex, walletEndIndex);
  }, [filteredWallets, walletStartIndex, walletEndIndex]);

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'school':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Building2 className="w-3 h-3" /> School
          </span>
        );
      case 'parent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Users className="w-3 h-3" /> Parent
          </span>
        );
      case 'escort':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Shield className="w-3 h-3" /> Escort / Driver
          </span>
        );
      case 'platform_treasury':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Landmark className="w-3 h-3" /> Platform Treasury
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
            {type}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading Financial Ledger &amp; Wallet Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Super Admin Financial Centre
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track live platform transactions, deposits, fee shares, and wallet balances in real time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Available Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Floating Balance
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₦{(summary?.total_available_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {summary?.total_wallets_count || 0} Wallets
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Total liquid funds currently held across all user &amp; school wallets.</p>
        </div>

        {/* Total Deposits Processed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Total Inflows &amp; Deposits
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
              ₦{(summary?.total_deposits_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              SeerBit Inflow
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Gross funds successfully paid in via cards &amp; virtual accounts.</p>
        </div>

        {/* Platform Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Platform Treasury Revenue
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700 font-mono tracking-tight">
              ₦{(summary?.total_platform_revenue_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Commission
            </span>
          </div>
          <p className="text-[11px] text-slate-500">MyEduRide retained revenue (VAT + 20% net KM fee share).</p>
        </div>

        {/* Pending Escrow / Driver Payouts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Pending Escrow &amp; Earnings
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700 font-mono tracking-tight">
              ₦{(summary?.total_pending_ngn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Held
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Escrow trip holds pending driver confirmation or settlement.</p>
        </div>
      </div>

      {/* 3. Primary Table Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-5 pt-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                activeTab === 'transactions'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit Transactions ({transactions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wallets')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                activeTab === 'wallets'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>All Wallets ({wallets.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-400 pb-2 sm:pb-0">
            Real-Time Double-Entry Audit Logs
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'transactions' ? 'Search by reference, user, description...' : 'Search by name, email, account number...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Entity Filter */}
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-emerald-500"
            >
              <option value="all">All Account Types</option>
              <option value="school">Schools</option>
              <option value="parent">Parents</option>
              <option value="escort">Escorts / Drivers</option>
              <option value="platform_treasury">Platform Treasury</option>
            </select>

            {activeTab === 'transactions' && (
              <>
                {/* Transaction Type Filter */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-emerald-500"
                >
                  <option value="all">Credit &amp; Debit</option>
                  <option value="CREDIT">Credits (+) Inflows</option>
                  <option value="DEBIT">Debits (-) Outflows</option>
                </select>

                {/* Channel Filter */}
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-emerald-500"
                >
                  <option value="all">All Channels</option>
                  <option value="seerbit">SeerBit Gateway</option>
                  <option value="escrow">Trip Escrow Holds</option>
                  <option value="commission">Commission Revenue</option>
                  <option value="stipend">School Stipends</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* 4. Tab 1: Transaction Ledger Table */}
        {activeTab === 'transactions' && (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Account / Entity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Channel &amp; Reference</th>
                  <th className="py-3 px-4">Balance After</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No transactions match the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isCredit = tx.transaction_type === 'CREDIT';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          <span className="text-slate-400">
                            {new Date(tx.created_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        {/* Account & Entity Badge */}
                        <td className="py-3 px-4 min-w-[180px]">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]">
                            {tx.wallet_owner_name}
                          </div>
                          <div className="mt-0.5">{getEntityBadge(tx.wallet_entity_type)}</div>
                        </td>

                        {/* Type Indicator */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isCredit ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <ArrowDownLeft className="w-3 h-3" /> CREDIT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              <ArrowUpRight className="w-3 h-3" /> DEBIT
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-black text-sm">
                          <span className={isCredit ? 'text-emerald-700' : 'text-slate-900'}>
                            {isCredit ? '+' : '-'}₦{tx.amount_ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Channel & Reference */}
                        <td className="py-3 px-4">
                          <div className="font-mono text-[11px] font-bold text-slate-800 truncate max-w-[220px]">
                            {tx.reference}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                            {tx.description || tx.channel}
                          </div>
                        </td>

                        {/* Balance After */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-700">
                          ₦{tx.balance_after_ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Transactions */}
          {filteredTransactions.length > 0 && (
            <div className="p-3 sm:p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span>
                  Showing <strong className="text-slate-900 font-bold">{txStartIndex + 1}</strong> to{' '}
                  <strong className="text-slate-900 font-bold">{txEndIndex}</strong> of{' '}
                  <strong className="text-slate-900 font-bold">{filteredTransactions.length}</strong> transactions
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-400 hidden sm:inline">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalTxPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalTxPages <= 5) return true;
                      return p === 1 || p === totalTxPages || Math.abs(p - currentPage) <= 1;
                    })
                    .map((p, idx, arr) => {
                      const prevP = arr[idx - 1];
                      const showEllipsis = prevP && p - prevP > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                              currentPage === p
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalTxPages, p + 1))}
                  disabled={currentPage === totalTxPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalTxPages)}
                  disabled={currentPage === totalTxPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}

        {/* 5. Tab 2: Wallets List Table */}
        {activeTab === 'wallets' && (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Account Owner</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Available Balance</th>
                  <th className="py-3 px-4">Pending / Escrow</th>
                  <th className="py-3 px-4">Virtual Account (Inflow)</th>
                  <th className="py-3 px-4">Payout Account (Outflow)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredWallets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No wallets match the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedWallets.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Owner */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{w.owner_name}</div>
                        {w.owner_email && (
                          <div className="text-[11px] text-slate-500">{w.owner_email}</div>
                        )}
                        {w.school_name && w.entity_type !== 'school' && (
                          <div className="text-[10px] text-slate-400 mt-0.5">School: {w.school_name}</div>
                        )}
                      </td>

                      {/* Entity Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">{getEntityBadge(w.entity_type)}</td>

                      {/* Available Balance */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-black text-sm text-slate-900">
                        ₦{w.available_balance_ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Pending Balance */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                        {w.pending_earnings_ngn > 0 ? (
                          <span className="font-bold text-amber-700">
                            ₦{w.pending_earnings_ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          '₦0.00'
                        )}
                      </td>

                      {/* Virtual Account */}
                      <td className="py-3 px-4">
                        {w.virtual_account_number ? (
                          <div>
                            <div className="font-mono font-bold text-slate-900">
                              {w.virtual_account_number}
                            </div>
                            <div className="text-[10px] text-slate-500">{w.virtual_bank_name}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None generated</span>
                        )}
                      </td>

                      {/* Payout Account */}
                      <td className="py-3 px-4">
                        {w.payout_account_number ? (
                          <div>
                            <div className="font-mono font-bold text-slate-900">
                              {w.payout_account_number}
                            </div>
                            <div className="text-[10px] text-slate-500">{w.payout_account_name}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not connected</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls for Wallets */}
          {filteredWallets.length > 0 && (
            <div className="p-3 sm:p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span>
                  Showing <strong className="text-slate-900 font-bold">{walletStartIndex + 1}</strong> to{' '}
                  <strong className="text-slate-900 font-bold">{walletEndIndex}</strong> of{' '}
                  <strong className="text-slate-900 font-bold">{filteredWallets.length}</strong> wallets
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-400 hidden sm:inline">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalWalletPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalWalletPages <= 5) return true;
                      return p === 1 || p === totalWalletPages || Math.abs(p - currentPage) <= 1;
                    })
                    .map((p, idx, arr) => {
                      const prevP = arr[idx - 1];
                      const showEllipsis = prevP && p - prevP > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                              currentPage === p
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalWalletPages, p + 1))}
                  disabled={currentPage === totalWalletPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalWalletPages)}
                  disabled={currentPage === totalWalletPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* 6. Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Transaction Audit Details</h3>
                <p className="text-xs text-slate-500 font-mono">Reference: {selectedTx.reference}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Amount</span>
                <span className={`text-lg font-mono font-black ${selectedTx.transaction_type === 'CREDIT' ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {selectedTx.transaction_type === 'CREDIT' ? '+' : '-'}₦{selectedTx.amount_ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-400">Account Owner</span>
                  <span className="font-bold text-slate-900 block truncate mt-0.5">{selectedTx.wallet_owner_name}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{selectedTx.wallet_owner_email || 'No email attached'}</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-400">Channel / Gateway</span>
                  <span className="font-bold text-slate-900 block truncate mt-0.5">{selectedTx.channel}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{selectedTx.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 font-mono">
                <div className="p-2.5 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-400 font-sans">Balance Before</span>
                  <span className="font-bold text-slate-700 block mt-0.5">₦{selectedTx.balance_before_ngn.toLocaleString()}</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-100">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-400 font-sans">Balance After</span>
                  <span className="font-bold text-slate-900 block mt-0.5">₦{selectedTx.balance_after_ngn.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-100">
                <span className="block text-[10px] font-extrabold uppercase text-slate-400">Description</span>
                <span className="text-slate-800 font-medium block mt-0.5">{selectedTx.description || 'No description provided'}</span>
              </div>

              {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Metadata / Audit Payload</span>
                  <pre className="text-[10px] font-mono text-slate-700 overflow-x-auto p-2 bg-white rounded-lg border border-slate-200">
                    {JSON.stringify(selectedTx.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

