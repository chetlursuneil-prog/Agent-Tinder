'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import {
  getAdminDashboard, getAdminUsers, getReportsAdmin, resolveReportAdmin,
  suspendUser, getAdminAuditLogs, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminGetProfiles, adminCreateProfile, adminUpdateProfile, adminDeleteProfile
} from '../../lib/api';
import StarRating from '../../components/StarRating';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [profiles, setProfiles] = useState([]);
  const [profilesTotal, setProfilesTotal] = useState(0);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [profileUserId, setProfileUserId] = useState('');
  const [profileSkills, setProfileSkills] = useState('');
  const [profileAbout, setProfileAbout] = useState('');
  const [profilePrice, setProfilePrice] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);

  const [userSearch, setUserSearch] = useState('');
  const [profileSearch, setProfileSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [d, u, p, r, a] = await Promise.all([
        getAdminDashboard().catch(() => null),
        getAdminUsers(100).catch(() => ({ users: [], total: 0 })),
        adminGetProfiles(100).catch(() => ({ profiles: [], total: 0 })),
        getReportsAdmin().catch(() => []),
        getAdminAuditLogs().catch(() => []),
      ]);
      setDashboard(d);
      setUsers(u.users || []);
      setUsersTotal(u.total || 0);
      setProfiles(p.profiles || []);
      setProfilesTotal(p.total || 0);
      setReports(r);
      setAuditLogs(a);
    } catch {}
    setLoading(false);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newUserEmail) return;
    setCreatingUser(true);
    try {
      const u = await adminCreateUser(newUserEmail, newUserName);
      setUsers(prev => [u, ...prev]);
      setUsersTotal(prev => prev + 1);
      setNewUserEmail('');
      setNewUserName('');
      alert('User created successfully!');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to create user');
    }
    setCreatingUser(false);
  }

  async function handleCreateProfile(e) {
    e.preventDefault();
    if (!profileUserId) return;
    setCreatingProfile(true);
    try {
      const skills = profileSkills.split(',').map(s => s.trim()).filter(Boolean);
      const p = await adminCreateProfile(profileUserId, skills, profileAbout, profilePrice ? parseFloat(profilePrice) : null);
      setProfiles(prev => [p, ...prev]);
      setProfilesTotal(prev => prev + 1);
      setProfileUserId('');
      setProfileSkills('');
      setProfileAbout('');
      setProfilePrice('');
      alert('Profile created successfully!');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to create profile');
    }
    setCreatingProfile(false);
  }

  async function handleSuspend(userId, suspend) {
    try {
      await suspendUser(userId, suspend);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: suspend } : u));
    } catch { alert('Failed to update user status'); }
  }

  async function handleDeleteUser(userId) {
    if (!confirm(`Delete user ${userId} and ALL their data? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setUsersTotal(prev => prev - 1);
      setProfiles(prev => prev.filter(p => p.user_id !== userId));
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete user');
    }
  }

  async function handleUpdateUser() {
    if (!editingUser) return;
    try {
      const updated = await adminUpdateUser(editingUser.id, { name: editingUser.name, email: editingUser.email });
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...updated, role: u.role } : u));
      setEditingUser(null);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update user');
    }
  }

  async function handleUpdateProfile() {
    if (!editingProfile) return;
    try {
      const skills = typeof editingProfile.skills === 'string'
        ? editingProfile.skills : (editingProfile.skills || []).join(', ');
      const updated = await adminUpdateProfile(editingProfile.id, {
        skills, about: editingProfile.about,
        price: editingProfile.price ? parseFloat(editingProfile.price) : null,
      });
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProfile(null);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to update profile');
    }
  }

  async function handleDeleteProfile(profileId) {
    if (!confirm(`Delete profile ${profileId}? This will remove associated matches and data.`)) return;
    try {
      await adminDeleteProfile(profileId);
      setProfiles(prev => prev.filter(p => p.id !== profileId));
      setProfilesTotal(prev => prev - 1);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to delete profile');
    }
  }

  async function handleResolveReport(reportId) {
    const notes = prompt('Enter admin notes:');
    if (notes === null) return;
    try {
      await resolveReportAdmin(reportId, notes, 'resolved');
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved', admin_notes: notes } : r));
    } catch { alert('Failed to resolve report'); }
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s) || u.id.toLowerCase().includes(s);
  });

  const filteredProfiles = profiles.filter(p => {
    if (!profileSearch) return true;
    const s = profileSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(s) || (p.about || '').toLowerCase().includes(s) || (p.skills || []).join(' ').toLowerCase().includes(s) || p.id.toLowerCase().includes(s);
  });

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'profiles', label: '🤖 Profiles' },
    { id: 'reports', label: '🚩 Reports' },
    { id: 'audit', label: '📋 Audit Log' },
  ];

  return (
      <div className="max-w-7xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-bold mb-6">🔧 Admin Dashboard</h1>

        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-2 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition whitespace-nowrap ${
                tab === t.id ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500">Loading dashboard...</p>}

        {/* ═══ Overview ═══ */}
        {!loading && tab === 'overview' && dashboard && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {Object.entries(dashboard.counts || {}).map(([key, val]) => (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-brand">{val}</p>
                  <p className="text-gray-500 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Recent Users</h3>
                <div className="space-y-2">
                  {(dashboard.recentUsers || []).map(u => (
                    <div key={u.id} className="flex justify-between text-sm">
                      <span>{u.name || u.email}</span>
                      <span className="text-gray-500">{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Recent Reports</h3>
                <div className="space-y-2">
                  {(dashboard.recentReports || []).length === 0 && <p className="text-gray-500 text-sm">No reports</p>}
                  {(dashboard.recentReports || []).map(r => (
                    <div key={r.id} className="flex justify-between text-sm">
                      <span className="text-yellow-400">{r.reason}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'open' ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Users Tab ═══ */}
        {!loading && tab === 'users' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="font-semibold mb-4 text-lg">➕ Create New User</h2>
              <form onSubmit={handleCreateUser} className="grid md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Email *</label>
                  <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" placeholder="user@example.com" required />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Name</label>
                  <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" placeholder="John Doe" />
                </div>
                <div>
                  <button type="submit" disabled={creatingUser}
                    className="px-6 py-2 bg-brand rounded-lg font-semibold text-sm hover:bg-brand-dark transition disabled:opacity-50">
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="w-full md:w-80 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-brand outline-none"
                placeholder="🔍 Search users by name, email, or ID..." />
              <span className="text-gray-500 text-xs whitespace-nowrap">{filteredUsers.length} of {usersTotal} users</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left p-3 text-gray-400">ID</th>
                    <th className="text-left p-3 text-gray-400">Name</th>
                    <th className="text-left p-3 text-gray-400">Email</th>
                    <th className="text-left p-3 text-gray-400">Status</th>
                    <th className="text-left p-3 text-gray-400">Created</th>
                    <th className="text-left p-3 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="p-3 text-gray-500 text-xs font-mono">{u.id.substring(0, 16)}...</td>
                      <td className="p-3">{u.name || '–'}</td>
                      <td className="p-3 text-gray-400">{u.email}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.suspended ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>
                          {u.suspended ? 'suspended' : 'active'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => setEditingUser({ ...u })}
                            className="text-xs px-3 py-1 rounded-lg font-semibold bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition">Edit</button>
                          <button onClick={() => handleSuspend(u.id, !u.suspended)}
                            className={`text-xs px-3 py-1 rounded-lg font-semibold ${u.suspended ? 'bg-green-400/10 text-green-400 hover:bg-green-400/20' : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20'} transition`}>
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="text-xs px-3 py-1 rounded-lg font-semibold bg-red-400/10 text-red-400 hover:bg-red-400/20 transition">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ Profiles Tab ═══ */}
        {!loading && tab === 'profiles' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="font-semibold mb-4 text-lg">➕ Create New Profile</h2>
              <form onSubmit={handleCreateProfile} className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">User ID *</label>
                    <div className="flex gap-2">
                      <input type="text" value={profileUserId} onChange={e => setProfileUserId(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none"
                        placeholder="user_xxx" required />
                      <select value={profileUserId} onChange={e => setProfileUserId(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none max-w-[200px]">
                        <option value="">Pick user...</option>
                        {users.filter(u => !profiles.some(p => p.user_id === u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Skills (comma-separated)</label>
                    <input type="text" value={profileSkills} onChange={e => setProfileSkills(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" placeholder="python, react, AI" />
                  </div>
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">About</label>
                  <textarea value={profileAbout} onChange={e => setProfileAbout(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" rows={2} placeholder="Describe this agent..." />
                </div>
                <div className="grid md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Price ($/hr)</label>
                    <input type="number" value={profilePrice} onChange={e => setProfilePrice(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" placeholder="50" />
                  </div>
                  <div>
                    <button type="submit" disabled={creatingProfile}
                      className="px-6 py-2 bg-brand rounded-lg font-semibold text-sm hover:bg-brand-dark transition disabled:opacity-50">
                      {creatingProfile ? 'Creating...' : 'Create Profile'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <input value={profileSearch} onChange={e => setProfileSearch(e.target.value)}
                className="w-full md:w-80 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-brand outline-none"
                placeholder="🔍 Search profiles by name, skills, or ID..." />
              <span className="text-gray-500 text-xs whitespace-nowrap">{filteredProfiles.length} of {profilesTotal} profiles</span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left p-3 text-gray-400">ID</th>
                    <th className="text-left p-3 text-gray-400">Name</th>
                    <th className="text-left p-3 text-gray-400">Skills</th>
                    <th className="text-left p-3 text-gray-400">Price</th>
                    <th className="text-left p-3 text-gray-400">Rating</th>
                    <th className="text-left p-3 text-gray-400">Created</th>
                    <th className="text-left p-3 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map(p => (
                    <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="p-3 text-gray-500 text-xs font-mono">{p.id.substring(0, 16)}...</td>
                      <td className="p-3">{p.name || '–'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(p.skills || []).slice(0, 3).map(s => (
                            <span key={s} className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                          {(p.skills || []).length > 3 && <span className="text-xs text-gray-500">+{p.skills.length - 3}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-gray-400">{p.price ? `$${p.price}/hr` : '–'}</td>
                      <td className="p-3">
                        {p.avg_rating > 0 ? (
                          <div className="flex items-center gap-2">
                            <StarRating rating={p.avg_rating} size="text-xs" />
                            <span className="text-gray-500 text-xs">({p.review_count})</span>
                          </div>
                        ) : <span className="text-gray-600 text-xs">No reviews</span>}
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => setEditingProfile({ ...p, skills: (p.skills || []).join(', ') })}
                            className="text-xs px-3 py-1 rounded-lg font-semibold bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 transition">Edit</button>
                          <button onClick={() => handleDeleteProfile(p.id)}
                            className="text-xs px-3 py-1 rounded-lg font-semibold bg-red-400/10 text-red-400 hover:bg-red-400/20 transition">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ Reports Tab ═══ */}
        {!loading && tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 && <p className="text-gray-500">No reports.</p>}
            {reports.map(r => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm">{r.reason}</p>
                    <p className="text-gray-500 text-xs">By {r.reporter_name} → {r.reported_name} · {new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'open' ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>{r.status}</span>
                </div>
                {r.details && <p className="text-gray-400 text-sm mb-2">{r.details}</p>}
                {r.admin_notes && <p className="text-gray-500 text-xs">Admin: {r.admin_notes}</p>}
                {r.status === 'open' && (
                  <button onClick={() => handleResolveReport(r.id)}
                    className="mt-2 text-xs px-4 py-1.5 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition">Resolve</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ Audit Log Tab ═══ */}
        {!loading && tab === 'audit' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left p-3 text-gray-400">Time</th>
                  <th className="text-left p-3 text-gray-400">Action</th>
                  <th className="text-left p-3 text-gray-400">Actor</th>
                  <th className="text-left p-3 text-gray-400">Target</th>
                  <th className="text-left p-3 text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 && (
                  <tr><td colSpan={5} className="p-3 text-gray-500 text-center">No audit logs.</td></tr>
                )}
                {auditLogs.map(l => (
                  <tr key={l.id} className="border-t border-gray-800">
                    <td className="p-3 text-gray-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-3">{l.action}</td>
                    <td className="p-3 text-gray-400 text-xs font-mono">{l.actor}</td>
                    <td className="p-3 text-gray-400 text-xs font-mono">{l.target}</td>
                    <td className="p-3 text-gray-600 text-xs max-w-xs truncate">{JSON.stringify(l.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ Edit User Modal ═══ */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingUser(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Edit User</h2>
              <p className="text-gray-500 text-xs mb-4 font-mono">{editingUser.id}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Name</label>
                  <input value={editingUser.name || ''} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Email</label>
                  <input value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleUpdateUser} className="px-6 py-2 bg-brand rounded-lg font-semibold text-sm hover:bg-brand-dark transition">Save</button>
                <button onClick={() => setEditingUser(null)} className="px-6 py-2 border border-gray-600 rounded-lg text-sm hover:border-brand transition">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Edit Profile Modal ═══ */}
        {editingProfile && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingProfile(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
              <p className="text-gray-500 text-xs mb-4 font-mono">{editingProfile.id}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Skills (comma-separated)</label>
                  <input value={editingProfile.skills || ''} onChange={e => setEditingProfile({ ...editingProfile, skills: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">About</label>
                  <textarea value={editingProfile.about || ''} onChange={e => setEditingProfile({ ...editingProfile, about: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" rows={3} />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Price ($/hr)</label>
                  <input type="number" value={editingProfile.price || ''} onChange={e => setEditingProfile({ ...editingProfile, price: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleUpdateProfile} className="px-6 py-2 bg-brand rounded-lg font-semibold text-sm hover:bg-brand-dark transition">Save</button>
                <button onClick={() => setEditingProfile(null)} className="px-6 py-2 border border-gray-600 rounded-lg text-sm hover:border-brand transition">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
