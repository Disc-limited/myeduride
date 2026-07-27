'use client';

import { useState, useRef, useEffect } from 'react';
import { useParentSearch, ParentUser } from '@/hooks/useParentSearch';
import { Search, UserCheck, X, UserPlus, Phone, Mail, Hash, Loader2 } from 'lucide-react';

interface ParentSelectAutocompleteProps {
  schoolId: string | null;
  selectedParent: ParentUser | null;
  onSelectParent: (parent: ParentUser | null) => void;
  onQueryChange: (q: string) => void;
  queryValue: string;
  disabled?: boolean;
}

export default function ParentSelectAutocomplete({
  schoolId,
  selectedParent,
  onSelectParent,
  onQueryChange,
  queryValue,
  disabled = false,
}: ParentSelectAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { parents, isFetching, isLoading } = useParentSearch(schoolId, queryValue);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (parent: ParentUser) => {
    onSelectParent(parent);
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onSelectParent(null);
    onQueryChange('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  if (selectedParent) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
            {selectedParent.full_name?.charAt(0).toUpperCase() || 'P'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm truncate">
                {selectedParent.full_name || 'Existing Parent'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium shrink-0">
                <UserCheck size={12} /> Linked Existing Parent
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 font-mono mt-0.5">
              <span>@{selectedParent.username}</span>
              {selectedParent.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} className="text-gray-400" /> {selectedParent.phone}
                </span>
              )}
              {selectedParent.email && (
                <span className="flex items-center gap-1">
                  <Mail size={11} className="text-gray-400" /> {selectedParent.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearSelection}
          className="btn-ghost text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-colors shrink-0"
        >
          <X size={14} /> Change Parent
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Search & Link Existing Parent
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search size={16} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={queryValue}
          onChange={(e) => {
            onQueryChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder="Search by Parent Name, Username/ID, Phone, or Email…"
          className="input pl-9 pr-9 w-full min-h-[44px] text-sm rounded-xl"
          autoComplete="off"
        />

        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
          {isFetching || isLoading ? (
            <Loader2 size={16} className="animate-spin text-primary-600" />
          ) : queryValue ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQueryChange('');
              }}
              className="pointer-events-auto hover:text-gray-600"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1.5 max-h-72 overflow-y-auto divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header indicator */}
          <div className="px-3.5 py-2 bg-gray-50 text-[11px] font-medium text-gray-500 flex items-center justify-between">
            <span>
              {queryValue.trim()
                ? `Matching parents (${parents.length})`
                : parents.length > 0
                ? `Existing Parents in School (${parents.length})`
                : 'Searching existing parents…'}
            </span>
            <span className="text-[10px] text-gray-400">Search by Name, Handle, Phone, Email</span>
          </div>

          {parents.length > 0 ? (
            parents.map((parent) => (
              <button
                key={parent.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(parent)}
                className="w-full text-left px-3.5 py-3 hover:bg-primary-50/70 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                    {parent.full_name?.charAt(0).toUpperCase() || 'P'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 truncate">
                      {parent.full_name || 'Unnamed Parent'}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 font-mono">
                      <span className="text-primary-600">@{parent.username}</span>
                      {parent.phone && <span>· {parent.phone}</span>}
                      {parent.email && <span className="truncate max-w-[180px]">· {parent.email}</span>}
                    </div>
                  </div>
                </div>

                <span className="text-xs font-medium text-primary-600 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
                  Select ↵
                </span>
              </button>
            ))
          ) : !isFetching && !isLoading ? (
            <div className="p-4 text-center">
              {queryValue.trim() ? (
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-800 mb-1 flex items-center justify-center gap-1.5">
                    <UserPlus size={16} className="text-primary-600" />
                    No existing parent matches &quot;{queryValue}&quot;
                  </p>
                  <p className="text-xs text-gray-500">
                    Fill in the parent details below to automatically register a new parent account.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No existing parents found in this school yet.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
