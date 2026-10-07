import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  jurisdiction: string | null;
  active: boolean;
  createdAt: string;
}

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/auth/admin/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, role: string, jurisdiction: string) => {
    try {
      await apiFetch(`/api/auth/admin/users/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ role, jurisdiction })
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this user?')) return;
    try {
      await apiFetch(`/api/auth/admin/users/${id}/revoke`, {
        method: 'PATCH'
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Revocation failed');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center py-20 font-mono text-[12px] text-[var(--ink-soft)] uppercase tracking-wider">
      <div className="w-4 h-4 border-2 border-[var(--ink)] border-t-[var(--teal)] rounded-full animate-spin mr-3"></div>
      Loading users...
    </div>
  );

  return (
    <div className="bg-white/40 backdrop-blur-md p-5 rounded-xl border border-[var(--line)] shadow-sm">
      <h3 className="font-display font-semibold text-[18px] mb-5 flex items-center gap-2 tracking-tight">
        <Shield className="w-5 h-5 text-[var(--teal)]"/> Access Management
      </h3>
      
      {error && <div className="mb-4 text-[rgba(162,59,46,1)] text-sm">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--paper)] text-[10px] font-mono text-[var(--teal)] uppercase tracking-wider border-b border-[var(--line-strong)]">
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Status/Role</th>
              <th className="px-4 py-3 font-bold">Jurisdiction</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[12px] text-[var(--ink)]">
            {users.map(user => (
              <tr key={user._id} className="border-b border-[var(--line)] hover:bg-white/50 transition-colors">
                <td className="px-4 py-3 font-semibold">{user.name}</td>
                <td className="px-4 py-3 font-mono text-[11px]">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-[2px] font-bold text-[10px] uppercase tracking-wider ${
                    user.role === 'pending' ? 'bg-[var(--saffron)]/10 text-[var(--saffron)] border border-[var(--saffron)]/30'
                    : user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-[var(--teal)]/10 text-[var(--teal)] border border-[var(--teal)]/30'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-[11px]">{user.jurisdiction || '-'}</td>
                <td className="px-4 py-3 text-right">
                  {user.role === 'pending' ? (
                    <div className="flex gap-2 justify-end">
                      <select 
                        id={`role-${user._id}`}
                        className="text-[10px] border border-[var(--line-strong)] rounded px-1 py-1 outline-none"
                        defaultValue="officer"
                      >
                        <option value="officer">Officer</option>
                        <option value="field_team">Field Team</option>
                        <option value="ngo">NGO</option>
                      </select>
                      <select 
                        id={`jur-${user._id}`}
                        className="text-[10px] border border-[var(--line-strong)] rounded px-1 py-1 outline-none"
                        defaultValue="MCGM"
                      >
                        <option value="ALL">ALL (Admin)</option>
                        <option value="MCGM">MCGM</option>
                        <option value="THANE">THANE</option>
                        <option value="NAVI_MUMBAI">NAVI_MUMBAI</option>
                        <option value="PALGHAR">PALGHAR</option>
                      </select>
                      <button 
                        onClick={() => {
                          const role = (document.getElementById(`role-${user._id}`) as HTMLSelectElement).value;
                          const jur = (document.getElementById(`jur-${user._id}`) as HTMLSelectElement).value;
                          handleApprove(user._id, role, jur);
                        }}
                        className="bg-[var(--teal)] text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-[var(--teal)]/90 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3"/> Approve
                      </button>
                    </div>
                  ) : (
                    user.role !== 'admin' && (
                      <button 
                        onClick={() => handleRevoke(user._id)}
                        className="bg-[rgba(162,59,46,0.1)] text-[rgba(162,59,46,1)] border border-[rgba(162,59,46,0.3)] px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ml-auto hover:bg-[rgba(162,59,46,0.2)] transition-colors"
                      >
                        <XCircle className="w-3 h-3"/> Revoke
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)] italic">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
