'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  PlusCircle,
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
  DollarSign,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolGateCreditsModal from '@/components/school-admin/SchoolGateCreditsModal';

interface WalletItem {
  id: string;
  user_id: string | null;
  school_id: string | null;
  entity_type: 'parent' | 'escort' | 'school' | 'platform_treasury';
  owner_name: string;
  owner_username: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_avatar: string | null;
  school_name: string | null;
  gate_credit_units?: number | null;
  free_trial_credits_claimed?: boolean | null;
  currency: string;
  available_balance_ngn: number;
  reserved_balance_ngn: number;
  pending_earnings_ngn: number;
  escrow_balance_ngn: number;
  virtual_account_number: string | null;
  virtual_bank_name: string | null;
  virtual_account_name: string | null;
  virtual_account_reference: string | null;
  payout_bank_code: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  payout_bank_verified: boolean;
  status: 'active' | 'frozen' | 'suspended' | 'closed';
  created_at: string;
  updated_at: string;
}

interface CandidateUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  hasParentWallet: boolean;
  hasEscortWallet: boolean;
}

interface CandidateSchool {
  id: string;
  name: string;
  hasWallet: boolean;
  gate_credit_units?: number;
  free_trial_credits_claimed?: boolean;
}

interface StatsSummary {
  total_wallets: number;
  active_wallets: number;
  frozen_wallets: number;
  total_float_ngn: number;
  total_reserved_ngn: number;
  total_school_gate_units?: number;
  total_schools?: number;
}

export default function WalletAdminView() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [candidateUsers, setCandidateUsers] = useState<CandidateUser[]>([]);
  const [candidateSchools, setCandidateSchools] = useState<CandidateSchool[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [gateCreditsSchoolId, setGateCreditsSchoolId] = useState<string | null>(null);

  // Active wallet targets for modals
  const [activeWallet, setActiveWallet] = useState<WalletItem | null>(null);
  const [inspectData, setInspectData] = useState<{
    transactions: any[];
    escrow_holds: any[];
    loading: boolean;
  }>({ transactions: [], escrow_holds: [], loading: false });

  // Create Form State
  const [createForm, setCreateForm] = useState({
    entity_type: 'parent' as 'parent' | 'escort' | 'school' | 'platform_treasury',
    user_id: '',
    school_id: '',
    initial_balance_ngn: '',
    status: 'active' as 'active' | 'frozen',
    virtual_account_number: '',
    virtual_bank_name: 'Wema Bank (SeerBit)',
    virtual_account_name: '',
    notes: '',
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    status: 'active' as 'active' | 'frozen' | 'suspended' | 'closed',
    virtual_account_number: '',
    virtual_bank_name: '',
    virtual_account_name: '',
    virtual_account_reference: '',
    payout_bank_code: '',
    payout_account_number: '',
    payout_account_name: '',
    payout_bank_verified: false,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Adjust Form State
  const [adjustForm, setAdjustForm] = useState({
    type: 'CREDIT' as 'CREDIT' | 'DEBIT',
    amount_ngn: '',
    reason: '',
  });
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Delete Action State
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  // Virtual Account Generation state
  const [generatingVaId, setGeneratingVaId] = useState<string | null>(null);

  const handleGenerateVirtualAccount = async (w: WalletItem) => {
    setGeneratingVaId(w.id);
    try {
      toast.loading('Provisioning SeerBit virtual account...', { id: `gen-${w.id}` });
      const res = await fetch(`/api/super-admin/wallets/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate_virtual_account: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue virtual account');

      toast.success(
        `Virtual Account issued: ${data.wallet?.virtual_account_number || 'Success'}`,
        { id: `gen-${w.id}` }
      );
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error provisioning virtual account', { id: `gen-${w.id}` });
    } finally {
      setGeneratingVaId(null);
    }
  };

  // Fetch wallets from API
  const fetchWallets = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/super-admin/wallets?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load wallets');
      }

      setWallets(data.wallets || []);
      setCandidateUsers(data.candidateUsers || []);
      setCandidateSchools(data.candidateSchools || []);
      setStats(data.stats || null);

      if (isRefresh) {
        toast.success('Wallet administration ledger refreshed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error loading wallet records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  // Filtered wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.id?.toLowerCase().includes(q) ||
        w.owner_name?.toLowerCase().includes(q) ||
        w.owner_email?.toLowerCase().includes(q) ||
        w.owner_phone?.toLowerCase().includes(q) ||
        w.school_name?.toLowerCase().includes(q) ||
        w.virtual_account_number?.toLowerCase().includes(q) ||
        w.virtual_account_reference?.toLowerCase().includes(q) ||
        w.payout_account_number?.toLowerCase().includes(q);

      const matchesEntity = entityFilter === 'all' || w.entity_type === entityFilter;
      const matchesStatus = statusFilter === 'all' || (w.status || 'active').toLowerCase() === statusFilter;

      let matchesBalance = true;
      if (balanceFilter === 'has_funds') {
        matchesBalance = (w.available_balance_ngn || 0) > 0;
      } else if (balanceFilter === 'zero_funds') {
        matchesBalance = (w.available_balance_ngn || 0) === 0;
      }

      return matchesSearch && matchesEntity && matchesStatus && matchesBalance;
    });
  }, [wallets, searchQuery, entityFilter, statusFilter, balanceFilter]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, entityFilter, statusFilter, balanceFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredWallets.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredWallets.length);
  const paginatedWallets = useMemo(() => {
    return filteredWallets.slice(startIndex, endIndex);
  }, [filteredWallets, startIndex, endIndex]);

  // Copy handler
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Open Edit Modal
  const openEditModal = (w: WalletItem) => {
    setActiveWallet(w);
    setEditForm({
      status: w.status || 'active',
      virtual_account_number: w.virtual_account_number || '',
      virtual_bank_name: w.virtual_bank_name || '',
      virtual_account_name: w.virtual_account_name || '',
      virtual_account_reference: w.virtual_account_reference || '',
      payout_bank_code: w.payout_bank_code || '',
      payout_account_number: w.payout_account_number || '',
      payout_account_name: w.payout_account_name || '',
      payout_bank_verified: Boolean(w.payout_bank_verified),
    });
    setShowEditModal(true);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/super-admin/wallets/${activeWallet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update wallet');

      toast.success('Wallet settings updated successfully');
      setShowEditModal(false);
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error updating wallet');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open Adjust Balance Modal
  const openAdjustModal = (w: WalletItem) => {
    setActiveWallet(w);
    setAdjustForm({
      type: 'CREDIT',
      amount_ngn: '',
      reason: '',
    });
    setShowAdjustModal(true);
  };

  // Submit Adjust Balance
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;

    const amount = parseFloat(adjustForm.amount_ngn);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    if (!adjustForm.reason.trim()) {
      toast.error('Audit reason is required for any manual balance adjustment');
      return;
    }

    setSubmittingAdjust(true);
    try {
      const res = await fetch(`/api/super-admin/wallets/${activeWallet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: {
            type: adjustForm.type,
            amount_ngn: amount,
            reason: adjustForm.reason.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust balance');

      toast.success(
        `Wallet ${adjustForm.type === 'CREDIT' ? 'credited' : 'debited'} with ₦${amount.toLocaleString(
          'en-NG',
          { minimumFractionDigits: 2 }
        )}`
      );
      setShowAdjustModal(false);
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error processing balance adjustment');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Toggle Quick Freeze / Unfreeze
  const handleToggleFreeze = async (w: WalletItem) => {
    const isCurrentlyActive = (w.status || 'active').toLowerCase() === 'active';
    const nextStatus = isCurrentlyActive ? 'frozen' : 'active';

    try {
      const res = await fetch(`/api/super-admin/wallets/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle wallet status');

      toast.success(`Wallet is now ${nextStatus.toUpperCase()}`);
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error changing wallet status');
    }
  };

  // Open Inspect Modal
  const openInspectModal = async (w: WalletItem) => {
    setActiveWallet(w);
    setShowInspectModal(true);
    setInspectData({ transactions: [], escrow_holds: [], loading: true });

    try {
      const res = await fetch(`/api/super-admin/wallets/${w.id}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setInspectData({
          transactions: data.transactions || [],
          escrow_holds: data.escrow_holds || [],
          loading: false,
        });
      }
    } catch (err) {
      console.error(err);
      setInspectData((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Delete Modal
  const openDeleteModal = (w: WalletItem) => {
    setActiveWallet(w);
    setForceDelete(false);
    setShowDeleteModal(true);
  };

  // Submit Delete
  const handleDeleteWallet = async () => {
    if (!activeWallet) return;

    setSubmittingDelete(true);
    try {
      const res = await fetch(
        `/api/super-admin/wallets/${activeWallet.id}?force=${forceDelete ? 'true' : 'false'}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete wallet');

      toast.success('Wallet removed from the system');
      setShowDeleteModal(false);
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error deleting wallet');
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Handle Create Wallet Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (createForm.entity_type === 'school' && !createForm.school_id) {
      toast.error('Please select a school');
      return;
    }

    if ((createForm.entity_type === 'parent' || createForm.entity_type === 'escort') && !createForm.user_id) {
      toast.error('Please select a user');
      return;
    }

    setSubmittingCreate(true);
    try {
      const payload: any = {
        entity_type: createForm.entity_type,
        status: createForm.status,
        virtual_bank_name: createForm.virtual_bank_name,
        virtual_account_number: createForm.virtual_account_number || undefined,
        virtual_account_name: createForm.virtual_account_name || undefined,
        notes: createForm.notes || undefined,
      };

      if (createForm.user_id) payload.user_id = createForm.user_id;
      if (createForm.school_id) payload.school_id = createForm.school_id;
      if (createForm.initial_balance_ngn) {
        payload.initial_balance_ngn = parseFloat(createForm.initial_balance_ngn);
      }

      const res = await fetch('/api/super-admin/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create wallet');

      toast.success('New wallet initialized successfully');
      setShowCreateModal(false);
      setCreateForm({
        entity_type: 'parent',
        user_id: '',
        school_id: '',
        initial_balance_ngn: '',
        status: 'active',
        virtual_account_number: '',
        virtual_bank_name: 'Wema Bank (SeerBit)',
        virtual_account_name: '',
        notes: '',
      });
      fetchWallets(true);
    } catch (err: any) {
      toast.error(err.message || 'Error creating wallet');
    } finally {
      setSubmittingCreate(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet size={20} className="sm:w-6 sm:h-6" />
            </span>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Wallet Administration Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2 sm:line-clamp-none">
            Complete CRUD control: create, audit, adjust balances, freeze, or delete user and school digital wallets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => fetchWallets(true)}
            disabled={refreshing || loading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const firstSchoolId =
                candidateSchools[0]?.id ||
                wallets.find((w) => w.entity_type === 'school' && w.school_id)?.school_id ||
                null;
              if (firstSchoolId) {
                setGateCreditsSchoolId(firstSchoolId);
              } else {
                toast.info('No school records found');
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300/80 rounded-xl shadow-2xs transition-all cursor-pointer"
            title="Manage School Gate Credit Units, Packages, and Monthly Reports"
          >
            <CreditCard size={16} className="text-emerald-700" />
            <span>School Gate Credits</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle size={16} />
            <span>Create Wallet</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview - 2x2 on Mobile, 5 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 w-full min-w-0">
        {/* Total Wallets */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block truncate">
              Total Wallets
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : (stats?.total_wallets ?? wallets.length)}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 block truncate">Registered across system</span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 ml-2">
            <Users size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block truncate">
              Active Wallets
            </span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">
              {loading ? '...' : (stats?.active_wallets ?? 0)}
            </div>
            <span className="text-[10px] sm:text-xs text-emerald-600/80 font-medium block truncate">Ready for transactions</span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ml-2">
            <CheckCircle2 size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
        </div>

        {/* Frozen / Suspended */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block truncate">
              Frozen / Restricted
            </span>
            <div className="text-xl sm:text-2xl font-bold text-amber-600 mt-0.5">
              {loading ? '...' : (stats?.frozen_wallets ?? 0)}
            </div>
            <span className="text-[10px] sm:text-xs text-amber-600/80 font-medium block truncate">Restricted ops</span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 ml-2">
            <Lock size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
        </div>

        {/* Total Liquid Float */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block truncate">
              Total Float
            </span>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 truncate font-mono">
              {loading
                ? '...'
                : `₦${(stats?.total_float_ngn ?? 0).toLocaleString('en-NG', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-400 block truncate">Available user funds</span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 ml-2">
            <DollarSign size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
        </div>

        {/* School Gate Credit Units */}
        <button
          type="button"
          onClick={() => setEntityFilter(entityFilter === 'school' ? 'all' : 'school')}
          className="col-span-2 lg:col-span-1 text-left bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 hover:from-emerald-100/80 p-3 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between transition-all cursor-pointer group"
          title="Click to filter School Wallets & manage Gate Credit Units"
        >
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-800 block truncate">
              School Gate Credits
            </span>
            <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-0.5 truncate font-mono">
              {loading
                ? '...'
                : `${Number(
                    stats?.total_school_gate_units ??
                      wallets
                        .filter((w) => w.entity_type === 'school')
                        .reduce((acc, w) => acc + (w.gate_credit_units ?? 25), 0)
                  ).toFixed(1)} U`}
            </div>
            <span className="text-[10px] sm:text-xs text-emerald-700/80 font-semibold block truncate group-hover:underline">
              {entityFilter === 'school' ? 'Showing Schools (Click for All)' : 'Click to view School Units →'}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2 shadow-xs">
            <CreditCard size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
        </button>
      </div>

      {/* Filter and Search Bar - Mobile Optimized */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 w-full min-w-0">
        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by owner, email, phone, account number, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Quick Entity Type Pills for Mobile & Desktop */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: `All Wallets (${wallets.length})` },
            { id: 'parent', label: `Parents (${wallets.filter((w) => w.entity_type === 'parent').length})` },
            { id: 'escort', label: `Escorts / Drivers (${wallets.filter((w) => w.entity_type === 'escort').length})` },
            { id: 'school', label: `Schools & Gate Credits (${wallets.filter((w) => w.entity_type === 'school').length})` },
            { id: 'platform_treasury', label: 'Treasury' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEntityFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                entityFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status and Balance Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="frozen">Frozen / Suspended</option>
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Balances</option>
            <option value="has_funds">Has Balance (&gt; ₦0)</option>
            <option value="zero_funds">Zero Balance (₦0.00)</option>
          </select>

          {(searchQuery || entityFilter !== 'all' || statusFilter !== 'all' || balanceFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setEntityFilter('all');
                setStatusFilter('all');
                setBalanceFilter('all');
              }}
              className="text-xs text-emerald-600 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Count Indicator */}
        <div className="text-[11px] text-slate-400">
          Showing <strong className="text-slate-800">{filteredWallets.length}</strong> of{' '}
          <strong className="text-slate-800">{wallets.length}</strong> wallets
        </div>
      </div>

      {/* Wallets Display: Responsive Table on Desktop, Native Cards on Mobile */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden w-full min-w-0">
        {/* Desktop View (visible on md+) */}
        <div className="hidden md:block overflow-x-auto w-full min-w-0">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Account / Entity</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-4">Available Balance</th>
                <th className="py-3 px-4">Gate Credits</th>
                <th className="py-3 px-4">Virtual Account</th>
                <th className="py-3 px-4">Payout Account</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading wallet records...
                  </td>
                </tr>
              ) : filteredWallets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Wallet size={32} className="mx-auto mb-2 text-slate-300" />
                    No wallets found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedWallets.map((w) => {
                  const isTreasury = w.entity_type === 'platform_treasury';
                  const isSchool = w.entity_type === 'school';
                  const isEscort = w.entity_type === 'escort';
                  const isParent = w.entity_type === 'parent';
                  const isActive = (w.status || 'active').toLowerCase() === 'active';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Account / Owner */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isTreasury
                                ? 'bg-amber-100 text-amber-700'
                                : isSchool
                                ? 'bg-purple-100 text-purple-700'
                                : isEscort
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isTreasury ? (
                              <Shield size={16} />
                            ) : isSchool ? (
                              <Building2 size={16} />
                            ) : (
                              (w.owner_name || 'U').slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                              <span className="truncate">{w.owner_name}</span>
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {w.owner_email || w.owner_phone || (isSchool ? 'School Main Account' : 'Platform System')}
                            </div>
                            {w.school_name && !isSchool && (
                              <div className="text-[11px] text-slate-400 truncate font-mono">
                                🏫 {w.school_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                            isTreasury
                              ? 'bg-amber-100 text-amber-800'
                              : isSchool
                              ? 'bg-purple-100 text-purple-800'
                              : isEscort
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {w.entity_type}
                        </span>
                      </td>

                      {/* Available Balance */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          ₦
                          {w.available_balance_ngn.toLocaleString('en-NG', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        {(w.reserved_balance_ngn > 0 || w.pending_earnings_ngn > 0) && (
                          <div className="text-[11px] text-amber-600 font-mono">
                            +₦{(w.reserved_balance_ngn + w.pending_earnings_ngn).toLocaleString('en-NG', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            held
                          </div>
                        )}
                      </td>

                      {/* Gate Credits */}
                      <td className="py-3.5 px-4">
                        {isSchool && w.school_id ? (
                          <button
                            type="button"
                            onClick={() => setGateCreditsSchoolId(w.school_id!)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-xs font-extrabold cursor-pointer transition shadow-2xs"
                            title="Click to manage School Gate Credit Units, Packages & Monthly Reports"
                          >
                            <CreditCard size={13} className="text-emerald-600 shrink-0" />
                            <span>{Number(w.gate_credit_units ?? 25).toFixed(1)} Units</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEntityFilter('school')}
                            className="text-[11px] text-slate-400 hover:text-emerald-700 font-medium cursor-pointer transition"
                            title="Gate Credit Units apply to School accounts. Click to view School Wallets."
                          >
                            School only →
                          </button>
                        )}
                      </td>

                      {/* Virtual Account */}
                      <td className="py-3.5 px-4">
                        {w.virtual_account_number ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
                              <span>{w.virtual_account_number}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(w.virtual_account_number!, `va-${w.id}`)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Copy account number"
                              >
                                {copiedKey === `va-${w.id}` ? (
                                  <Check size={12} className="text-emerald-600" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {w.virtual_bank_name || 'Wema Bank (SeerBit)'}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGenerateVirtualAccount(w)}
                            disabled={generatingVaId === w.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Generate a dedicated SeerBit NUBAN for this wallet"
                          >
                            <CreditCard size={12} />
                            <span>{generatingVaId === w.id ? 'Issuing...' : '+ Issue Account'}</span>
                          </button>
                        )}
                      </td>

                      {/* Payout Account */}
                      <td className="py-3.5 px-4">
                        {w.payout_account_number ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
                              <span>{w.payout_account_number}</span>
                              {w.payout_bank_verified && (
                                <span title="Bank verified" className="text-emerald-600">
                                  <CheckCircle2 size={12} />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                              {w.payout_account_name || w.payout_bank_code || 'Settlement Bank'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not configured</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="capitalize">{w.status || 'active'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Manage School Gate Credits (for school wallets) */}
                          {isSchool && w.school_id && (
                            <button
                              type="button"
                              onClick={() => setGateCreditsSchoolId(w.school_id!)}
                              title="Manage School Gate Credit Units & Packages"
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <CreditCard size={15} />
                            </button>
                          )}

                          {/* Inspect / Ledger Details */}
                          <button
                            type="button"
                            onClick={() => openInspectModal(w)}
                            title="Inspect wallet ledger and history"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <ExternalLink size={15} />
                          </button>

                          {/* Adjust Balance */}
                          <button
                            type="button"
                            onClick={() => openAdjustModal(w)}
                            title="Adjust wallet balance (Credit / Debit)"
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <DollarSign size={15} />
                          </button>

                          {/* Quick Freeze / Unfreeze */}
                          <button
                            type="button"
                            onClick={() => handleToggleFreeze(w)}
                            title={isActive ? 'Freeze wallet' : 'Unfreeze wallet'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                          >
                            {isActive ? <Lock size={15} /> : <Unlock size={15} />}
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => openEditModal(w)}
                            title="Edit wallet metadata"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>

                          {/* Delete Wallet */}
                          {!isTreasury && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal(w)}
                              title="Delete wallet"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: High-UX Responsive Action Cards (visible on mobile, hidden on md+) */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
              Loading wallet records...
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Wallet size={32} className="mx-auto mb-2 text-slate-300" />
              No wallets found matching your filter criteria.
            </div>
          ) : (
            paginatedWallets.map((w) => {
              const isTreasury = w.entity_type === 'platform_treasury';
              const isSchool = w.entity_type === 'school';
              const isEscort = w.entity_type === 'escort';
              const isParent = w.entity_type === 'parent';
              const isActive = (w.status || 'active').toLowerCase() === 'active';

              return (
                <div key={w.id} className="p-3.5 space-y-3 hover:bg-slate-50/50 transition-colors">
                  {/* Top Row: Owner info, Entity pill & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isTreasury
                            ? 'bg-amber-100 text-amber-700'
                            : isSchool
                            ? 'bg-purple-100 text-purple-700'
                            : isEscort
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isTreasury ? (
                          <Shield size={16} />
                        ) : isSchool ? (
                          <Building2 size={16} />
                        ) : (
                          (w.owner_name || 'U').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">
                          {w.owner_name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {w.owner_email || w.owner_phone || (isSchool ? 'School Main Account' : 'Platform System')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isTreasury
                            ? 'bg-amber-100 text-amber-800'
                            : isSchool
                            ? 'bg-purple-100 text-purple-800'
                            : isEscort
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {w.entity_type}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="capitalize">{w.status || 'active'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle Box: Available Balance & Virtual Account Details */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Available Balance
                      </span>
                      <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        ₦{w.available_balance_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                      {(w.reserved_balance_ngn > 0 || w.pending_earnings_ngn > 0) && (
                        <div className="text-[10px] text-amber-600 font-mono">
                          +₦{(w.reserved_balance_ngn + w.pending_earnings_ngn).toLocaleString('en-NG', { minimumFractionDigits: 2 })} held
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Virtual Account
                      </span>
                      {w.virtual_account_number ? (
                        <div className="mt-0.5">
                          <div className="flex items-center gap-1 font-mono font-bold text-slate-900 text-xs">
                            <span>{w.virtual_account_number}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(w.virtual_account_number!, `va-m-${w.id}`)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy account number"
                            >
                              {copiedKey === `va-m-${w.id}` ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {w.virtual_bank_name || 'Wema Bank (SeerBit)'}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGenerateVirtualAccount(w)}
                          disabled={generatingVaId === w.id}
                          className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 rounded-md transition-colors disabled:opacity-50"
                        >
                          <CreditCard size={10} />
                          <span>{generatingVaId === w.id ? 'Issuing...' : '+ Issue'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions Row: Thumb-Friendly Touch Targets */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => openAdjustModal(w)}
                        className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200/80 transition-all active:scale-[0.98]"
                      >
                        <DollarSign size={13} />
                        <span>Adjust</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openInspectModal(w)}
                        className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all active:scale-[0.98]"
                      >
                        <ExternalLink size={13} />
                        <span>Ledger</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleFreeze(w)}
                        title={isActive ? 'Freeze wallet' : 'Unfreeze wallet'}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          isActive
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60'
                            : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60'
                        }`}
                      >
                        {isActive ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(w)}
                        title="Edit wallet"
                        className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>

                      {!isTreasury && (
                        <button
                          type="button"
                          onClick={() => openDeleteModal(w)}
                          title="Delete wallet"
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {filteredWallets.length > 0 && (
          <div className="p-3 sm:p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            {/* Left: Summary and Page Size */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span>
                Showing <strong className="text-slate-900 font-bold">{filteredWallets.length === 0 ? 0 : startIndex + 1}</strong> to{' '}
                <strong className="text-slate-900 font-bold">{endIndex}</strong> of{' '}
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

            {/* Right: Page Navigation Buttons */}
            <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                <ChevronsLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
              >
                <ChevronLeft size={15} />
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Page Number Pills */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 5) return true;
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. CREATE WALLET MODAL                                   */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <PlusCircle size={20} />
                </span>
                <h3 className="font-bold text-slate-900 text-lg">Create New Digital Wallet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-sm">
              {/* Entity Type Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Entity Type *
                </label>
                <select
                  value={createForm.entity_type}
                  onChange={(e) => {
                    const nextType = e.target.value as any;
                    setCreateForm({
                      ...createForm,
                      entity_type: nextType,
                      user_id: '',
                      school_id: '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="parent">Parent User Wallet</option>
                  <option value="escort">Escort / Driver Wallet</option>
                  <option value="school">School Institutional Wallet</option>
                  <option value="platform_treasury">Platform Treasury Wallet</option>
                </select>
              </div>

              {/* Target User or School Selector */}
              {createForm.entity_type === 'school' ? (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Select School *
                  </label>
                  <select
                    value={createForm.school_id}
                    onChange={(e) => setCreateForm({ ...createForm, school_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose School --</option>
                    {candidateSchools.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.hasWallet}>
                        {s.name} {s.hasWallet ? '(Already has wallet)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : createForm.entity_type === 'parent' || createForm.entity_type === 'escort' ? (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Select User *
                  </label>
                  <select
                    value={createForm.user_id}
                    onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose User Profile --</option>
                    {candidateUsers.map((u) => {
                      const alreadyHasThisWallet =
                        createForm.entity_type === 'parent' ? u.hasParentWallet : u.hasEscortWallet;
                      return (
                        <option key={u.id} value={u.id} disabled={alreadyHasThisWallet}>
                          {u.full_name} ({u.email || u.phone || 'No contact'}{' '}
                          {alreadyHasThisWallet ? '- already has wallet' : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}

              {/* Initial Balance */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Initial Opening Balance (₦ NGN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={createForm.initial_balance_ngn}
                  onChange={(e) => setCreateForm({ ...createForm, initial_balance_ngn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  Leave at 0.00 to start empty. Any opening amount will be recorded in the audit ledger.
                </span>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Initial Status
                </label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="active">Active (Default)</option>
                  <option value="frozen">Frozen (Restricted)</option>
                </select>
              </div>

              {/* Optional Virtual Account Number */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Virtual Account Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0819208946 (or auto-assigned via SeerBit)"
                  value={createForm.virtual_account_number}
                  onChange={(e) => setCreateForm({ ...createForm, virtual_account_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Admin Purpose / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Account initialization for new boarding parent"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {submittingCreate ? 'Creating...' : 'Create Wallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT WALLET MODAL                                     */}
      {/* ======================================================== */}
      {showEditModal && activeWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Edit2 size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Update Wallet Settings</h3>
                  <p className="text-xs text-slate-400">{activeWallet.owner_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Operating Status *
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                >
                  <option value="active">Active (Normal transactions enabled)</option>
                  <option value="frozen">Frozen (Deposits allowed, withdrawals blocked)</option>
                  <option value="suspended">Suspended (All actions blocked)</option>
                  <option value="closed">Closed (Decommissioned)</option>
                </select>
              </div>

              {/* Virtual Account Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Virtual Account Number
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!activeWallet) return;
                      await handleGenerateVirtualAccount(activeWallet);
                      setShowEditModal(false);
                    }}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    ⚡ Auto-Provision via SeerBit
                  </button>
                </div>
                <input
                  type="text"
                  value={editForm.virtual_account_number}
                  onChange={(e) => setEditForm({ ...editForm, virtual_account_number: e.target.value })}
                  placeholder="e.g. 0819208946"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              {/* Virtual Bank Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Virtual Bank Name
                </label>
                <input
                  type="text"
                  value={editForm.virtual_bank_name}
                  onChange={(e) => setEditForm({ ...editForm, virtual_bank_name: e.target.value })}
                  placeholder="e.g. Wema Bank (SeerBit)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Payout Bank Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Payout Bank Code
                  </label>
                  <input
                    type="text"
                    value={editForm.payout_bank_code}
                    onChange={(e) => setEditForm({ ...editForm, payout_bank_code: e.target.value })}
                    placeholder="e.g. 058 (GTB)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Payout Account No.
                  </label>
                  <input
                    type="text"
                    value={editForm.payout_account_number}
                    onChange={(e) => setEditForm({ ...editForm, payout_account_number: e.target.value })}
                    placeholder="10-digit NUBAN"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>
              </div>

              {/* Payout Account Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Payout Account Beneficiary Name
                </label>
                <input
                  type="text"
                  value={editForm.payout_account_name}
                  onChange={(e) => setEditForm({ ...editForm, payout_account_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase"
                />
              </div>

              {/* Bank Verified Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="payout_bank_verified"
                  checked={editForm.payout_bank_verified}
                  onChange={(e) => setEditForm({ ...editForm, payout_bank_verified: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="payout_bank_verified" className="text-xs font-medium text-slate-700">
                  Mark Payout Bank as Verified
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ADJUST BALANCE MODAL (Double-Entry Admin Ledger)      */}
      {/* ======================================================== */}
      {showAdjustModal && activeWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Adjust Wallet Balance</h3>
                  <p className="text-xs text-slate-400">{activeWallet.owner_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-sm">
              {/* Current balance card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Current Available:</span>
                <span className="font-mono font-bold text-slate-900 text-base">
                  ₦
                  {activeWallet.available_balance_ngn.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Adjustment Type Tabs */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Action Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'CREDIT' })}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      adjustForm.type === 'CREDIT'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownLeft size={14} />
                    Credit (Add Funds)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'DEBIT' })}
                    className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      adjustForm.type === 'DEBIT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight size={14} />
                    Debit (Deduct Funds)
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Adjustment Amount (₦ NGN) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                  value={adjustForm.amount_ngn}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount_ngn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-base font-bold text-slate-900"
                />
              </div>

              {/* Estimated New Balance */}
              {adjustForm.amount_ngn && parseFloat(adjustForm.amount_ngn) > 0 && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600">Resulting Balance:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₦
                    {Math.max(
                      0,
                      adjustForm.type === 'CREDIT'
                        ? activeWallet.available_balance_ngn + parseFloat(adjustForm.amount_ngn)
                        : activeWallet.available_balance_ngn - parseFloat(adjustForm.amount_ngn)
                    ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Audit Reason / Description *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Administrative refund for disputed ride payment..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className={`px-5 py-2 text-white font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50 ${
                    adjustForm.type === 'CREDIT'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingAdjust ? 'Processing...' : `Confirm ${adjustForm.type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. INSPECT DRAWER / MODAL (Ledger & Metadata)            */}
      {/* ======================================================== */}
      {showInspectModal && activeWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <ExternalLink size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Wallet Ledger Audit Trail</h3>
                  <p className="text-xs text-slate-400 font-mono">{activeWallet.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Owner</span>
                <div className="font-semibold text-slate-900 truncate mt-0.5">
                  {activeWallet.owner_name}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Entity Type</span>
                <div className="font-semibold text-slate-900 uppercase mt-0.5">
                  {activeWallet.entity_type}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Available Balance</span>
                <div className="font-mono font-bold text-emerald-700 mt-0.5">
                  ₦
                  {activeWallet.available_balance_ngn.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Virtual Account</span>
                <div className="font-mono font-semibold text-slate-900 mt-0.5">
                  {activeWallet.virtual_account_number || 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Payout Bank</span>
                <div className="font-mono text-slate-900 mt-0.5">
                  {activeWallet.payout_account_number || 'Not linked'}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Status</span>
                <div className="font-semibold text-slate-900 capitalize mt-0.5">
                  {activeWallet.status || 'active'}
                </div>
              </div>
            </div>

            {/* Ledger Transactions */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recent Ledger Entries ({inspectData.transactions.length})
              </h4>

              {inspectData.loading ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-emerald-600" />
                  Fetching ledger audit transactions...
                </div>
              ) : inspectData.transactions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No transaction records found for this wallet.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Amount</th>
                        <th className="p-2.5">Balance After</th>
                        <th className="p-2.5">Channel / Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {inspectData.transactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500 text-[11px]">
                            {new Date(tx.created_at).toLocaleDateString()}{' '}
                            {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.transaction_type === 'CREDIT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td
                            className={`p-2.5 font-bold ${
                              tx.transaction_type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.transaction_type === 'CREDIT' ? '+' : '-'}₦
                            {tx.amount_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-slate-700 font-semibold">
                            ₦{tx.balance_after_ngn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-slate-500 max-w-[160px] truncate font-sans text-[11px]">
                            {tx.description || tx.channel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. DELETE WALLET CONFIRMATION MODAL                      */}
      {/* ======================================================== */}
      {showDeleteModal && activeWallet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Delete Digital Wallet</h3>
                <p className="text-xs text-slate-400">Irreversible administrative action</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Are you sure you want to permanently delete the wallet for{' '}
                <strong className="text-slate-900">{activeWallet.owner_name}</strong>?
              </p>

              {activeWallet.available_balance_ngn > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle size={14} />
                    <span>Active Balance Warning</span>
                  </div>
                  <p>
                    This wallet currently holds liquid funds of{' '}
                    <strong>
                      ₦
                      {activeWallet.available_balance_ngn.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                    . Deleting it will purge the account balance.
                  </p>
                  <label className="flex items-center gap-2 pt-1 font-semibold text-rose-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceDelete}
                      onChange={(e) => setForceDelete(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span>Force delete and wipe remaining funds</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWallet}
                disabled={submittingDelete || (activeWallet.available_balance_ngn > 0 && !forceDelete)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-all shadow-xs disabled:opacity-40 text-sm"
              >
                {submittingDelete ? 'Deleting...' : 'Yes, Delete Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin School Gate Credits Management Modal */}
      <SchoolGateCreditsModal
        isOpen={!!gateCreditsSchoolId}
        onClose={() => setGateCreditsSchoolId(null)}
        schoolId={gateCreditsSchoolId || undefined}
        initialTab="ledger"
        isSuperAdmin={true}
        schoolsList={candidateSchools}
        onSelectSchool={(id) => setGateCreditsSchoolId(id)}
        onUpdated={() => fetchWallets(true)}
      />
    </div>
  );
}

