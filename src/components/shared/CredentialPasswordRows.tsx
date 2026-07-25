'use client';

import { Copy, KeyRound, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export type CredentialUser = {
  id: string;
  username: string;
  full_name: string;
  roles: string[];
  password: string;
  staff_id_number?: string | null;
  linked_students?: string[];
  failed_login_attempts?: number;
  locked_until?: string | null;
};

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

type Props = {
  users: CredentialUser[];
  draftPasswords: Record<string, string>;
  draftConfirmPasswords: Record<string, string>;
  setDraftPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setDraftConfirmPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (userId: string) => void;
  savingId: string | null;
  showPasswords: boolean;
  onUnlock?: (userId: string) => void;
  unlockingId?: string | null;
  onEdit?: (user: CredentialUser) => void;
};

export function CredentialPasswordRows({
  users,
  draftPasswords,
  draftConfirmPasswords,
  setDraftPasswords,
  setDraftConfirmPasswords,
  onSave,
  savingId,
  showPasswords,
  onUnlock,
  unlockingId,
  onEdit,
}: Props) {
  if (users.length === 0) return null;

  return (
    <tbody>
      {users.map((user) => {
        const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

        return (
          <tr key={user.id} className="border-b last:border-b-0 hover:bg-gray-50/80">
            <td className="py-3 px-5">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{user.full_name || '—'}</p>
                {isLocked && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800"
                    title={`Locked until ${new Date(user.locked_until!).toLocaleTimeString()}`}
                  >
                    Locked
                  </span>
                )}
              </div>
              {user.staff_id_number && (
                <p className="text-xs font-mono text-gray-500">{user.staff_id_number}</p>
              )}
              {user.linked_students?.length ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Child: {user.linked_students.join(', ')}
                </p>
              ) : null}
            </td>
            <td className="py-3 pr-4 font-mono text-xs">
              {user.username ? (
                user.username
              ) : (
                <span className="text-amber-700">No username — refresh page</span>
              )}
            </td>
            <td className="py-3 pr-4 capitalize text-xs">
              {user.roles.length ? user.roles.map(formatRole).join(', ') : '—'}
            </td>
            <td className="py-3 pr-3 min-w-[160px]">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={draftPasswords[user.id] ?? user.password ?? ''}
                onChange={(e) =>
                  setDraftPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
                }
                className="input h-9 font-mono text-xs w-full"
                placeholder="New password"
              />
            </td>
            <td className="py-3 pr-4 min-w-[160px]">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={draftConfirmPasswords[user.id] ?? user.password ?? ''}
                onChange={(e) =>
                  setDraftConfirmPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
                }
                className="input h-9 font-mono text-xs w-full"
                placeholder="Confirm password"
              />
            </td>
            <td className="py-3 pr-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pw = draftPasswords[user.id] ?? user.password ?? '';
                    navigator.clipboard.writeText(
                      `Username: ${user.username}\nPassword: ${pw || '(not set)'}`
                    );
                    toast.success('Copied');
                  }}
                  className="btn-secondary h-9 px-2.5"
                  title="Copy credentials"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSave(user.id)}
                  disabled={savingId === user.id}
                  className="btn-primary h-9 px-3 inline-flex items-center gap-1.5"
                >
                  <KeyRound size={14} />
                  {savingId === user.id ? 'Saving…' : 'Update'}
                </button>
                {onUnlock && isLocked && (
                  <button
                    type="button"
                    onClick={() => onUnlock(user.id)}
                    disabled={unlockingId === user.id}
                    className="px-2.5 h-9 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-all inline-flex items-center justify-center min-h-[36px]"
                  >
                    {unlockingId === user.id ? 'Unlocking…' : 'Unlock'}
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(user)}
                    className="btn-secondary h-9 px-2.5 flex items-center gap-1 text-xs"
                    title="Edit user details"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

export function CredentialPasswordTableHead() {
  return (
    <tr className="text-left border-b bg-white text-xs text-gray-500 uppercase">
      <th className="py-2.5 px-5 font-semibold">Name</th>
      <th className="py-2.5 pr-4 font-semibold">Username</th>
      <th className="py-2.5 pr-4 font-semibold">Role</th>
      <th className="py-2.5 pr-3 font-semibold">New password</th>
      <th className="py-2.5 pr-4 font-semibold">Confirm</th>
      <th className="py-2.5 pr-5 font-semibold">Actions</th>
    </tr>
  );
}
