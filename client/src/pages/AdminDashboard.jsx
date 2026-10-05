import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FaShieldAlt,
  FaUsers,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaArchive,
  FaFlag,
  FaHistory,
  FaSearch,
  FaStar,
  FaEdit,
  FaTrashAlt,
  FaBan,
  FaCheck,
  FaEye,
  FaTimes,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaCar,
  FaHome,
  FaFilter,
  FaRedo,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import {
  getAdminStats,
  getPendingListings,
  getAllListingsForAdmin,
  approveListing,
  rejectListing,
  toggleFeaturedListing,
  archiveListing,
  deleteListing,
  getAllUsers,
  toggleUserDisabled,
  getAllReports,
  updateReportStatus,
  getAuditLogs,
} from '../services/listingService';

export default function AdminDashboard() {
  const { currentUser } = useAuth();

  // Active navigation tab
  // 'overview' | 'pending' | 'listings' | 'users' | 'reports' | 'audit'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    archivedCount: 0,
    openReportsCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Pending queue
  const [pendingListings, setPendingListings] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [reviewingListing, setReviewingListing] = useState(null);

  // Reject modal state (Rule: required reason)
  const [rejectModalListing, setRejectModalListing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // All listings management
  const [allListings, setAllListings] = useState([]);
  const [loadingAllListings, setLoadingAllListings] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [listingSearchTerm, setListingSearchTerm] = useState('');

  // Users management
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Reports
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load stats
  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      console.warn('Failed to load admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load pending listings
  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const data = await getPendingListings();
      setPendingListings(data);
    } catch (err) {
      console.warn('Failed to load pending listings:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load all listings
  const loadAllListings = async (status = statusFilter) => {
    setLoadingAllListings(true);
    try {
      const data = await getAllListingsForAdmin(status);
      setAllListings(data);
    } catch (err) {
      console.warn('Failed to load all listings:', err);
    } finally {
      setLoadingAllListings(false);
    }
  };

  // Load users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.warn('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load reports
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await getAllReports();
      setReports(data);
    } catch (err) {
      console.warn('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const data = await getAuditLogs(50);
      setAuditLogs(data);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadStats();
    loadPending();
  }, []);

  // Tab switch loader
  useEffect(() => {
    if (activeTab === 'overview') {
      loadStats();
    } else if (activeTab === 'pending') {
      loadPending();
    } else if (activeTab === 'listings') {
      loadAllListings(statusFilter);
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'reports') {
      loadReports();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Handle Approve
  const handleApprove = async (id, title) => {
    try {
      await approveListing(id, currentUser.uid);
      showToast(`Listing "${title}" approved!`, 'success');
      setPendingListings((prev) => prev.filter((item) => item.id !== id));
      setAllListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
      );
      if (reviewingListing?.id === id) setReviewingListing(null);
      loadStats();
    } catch (err) {
      showToast('Approve error: ' + err.message, 'error');
    }
  };

  // Handle Reject Modal Submit
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting the listing.');
      return;
    }

    setRejecting(true);
    try {
      await rejectListing(rejectModalListing.id, rejectReason.trim(), currentUser.uid);
      showToast(`Listing "${rejectModalListing.title}" rejected.`, 'info');
      setPendingListings((prev) => prev.filter((item) => item.id !== rejectModalListing.id));
      setAllListings((prev) =>
        prev.map((item) =>
          item.id === rejectModalListing.id
            ? { ...item, status: 'rejected', rejectionReason: rejectReason.trim() }
            : item
        )
      );
      setRejectModalListing(null);
      setRejectReason('');
      if (reviewingListing?.id === rejectModalListing.id) setReviewingListing(null);
      loadStats();
    } catch (err) {
      showToast('Reject error: ' + err.message, 'error');
    } finally {
      setRejecting(false);
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (id, currentState, title) => {
    try {
      const nextState = !currentState;
      await toggleFeaturedListing(id, nextState, currentUser.uid);
      showToast(`Listing "${title}" ${nextState ? 'featured' : 'unfeatured'}.`, 'success');
      setAllListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, featured: nextState } : item))
      );
    } catch (err) {
      showToast('Feature error: ' + err.message, 'error');
    }
  };

  // Archive
  const handleArchive = async (id, title) => {
    if (!window.confirm(`Archive listing "${title}"? It will be hidden from public.`)) return;
    try {
      await archiveListing(id);
      showToast(`Listing "${title}" archived.`, 'info');
      setAllListings((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'archived' } : item))
      );
      loadStats();
    } catch (err) {
      showToast('Archive error: ' + err.message, 'error');
    }
  };

  // Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Permanently delete listing "${title}"? This cannot be undone.`)) return;
    try {
      await deleteListing(id);
      showToast(`Listing "${title}" deleted.`, 'info');
      setAllListings((prev) => prev.filter((item) => item.id !== id));
      setPendingListings((prev) => prev.filter((item) => item.id !== id));
      loadStats();
    } catch (err) {
      showToast('Delete error: ' + err.message, 'error');
    }
  };

  // Toggle user disabled
  const handleToggleUserDisabled = async (user) => {
    const nextState = !user.disabled;
    const actionLabel = nextState ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionLabel} user ${user.email}?`)) return;

    try {
      await toggleUserDisabled(user.uid, nextState, currentUser.uid);
      showToast(`User ${user.email} is now ${nextState ? 'disabled' : 'enabled'}.`, 'success');
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, disabled: nextState } : u))
      );
    } catch (err) {
      showToast('User status error: ' + err.message, 'error');
    }
  };

  // Update report status
  const handleReportStatusChange = async (reportId, newStatus) => {
    try {
      await updateReportStatus(reportId, newStatus);
      showToast(`Report updated to ${newStatus}.`, 'success');
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      showToast('Report update error: ' + err.message, 'error');
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = userSearchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.displayName && u.displayName.toLowerCase().includes(q))
    );
  });

  // Filtered Listings
  const filteredListings = allListings.filter((l) => {
    const q = listingSearchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.ownerEmail && l.ownerEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div className='max-w-7xl mx-auto px-4 py-8 space-y-6 text-slate-800'>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-bold transition flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : toast.type === 'info'
              ? 'bg-slate-900 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm'>
        <div className='space-y-1.5'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-amber-400'>
            <FaShieldAlt />
            <span>Administrator Control Center</span>
          </div>
          <h1 className='text-2xl sm:text-3xl font-black tracking-tight'>Admin Dashboard</h1>
          <p className='text-xs sm:text-sm text-slate-400'>
            Review incoming submissions, manage verified listings, monitor reports, and view audit trails.
          </p>
        </div>

        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => {
              loadStats();
              if (activeTab === 'pending') loadPending();
              if (activeTab === 'listings') loadAllListings(statusFilter);
              if (activeTab === 'users') loadUsers();
              if (activeTab === 'reports') loadReports();
              if (activeTab === 'audit') loadAuditLogs();
              showToast('Data refreshed from Firestore', 'info');
            }}
            className='inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer'
          >
            <FaRedo />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className='flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs sm:text-sm font-bold'>
        <button
          type='button'
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Overview &amp; Stats
        </button>

        <button
          type='button'
          onClick={() => setActiveTab('pending')}
          className={`relative px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Pending Review Queue</span>
          {stats.pendingCount > 0 && (
            <span className='px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950'>
              {stats.pendingCount}
            </span>
          )}
        </button>

        <button
          type='button'
          onClick={() => setActiveTab('listings')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'listings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Listings
        </button>

        <button
          type='button'
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Users Table
        </button>

        <button
          type='button'
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Reports Queue</span>
          {stats.openReportsCount > 0 && (
            <span className='px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white'>
              {stats.openReportsCount}
            </span>
          )}
        </button>

        <button
          type='button'
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Audit Logs
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className='space-y-6'>
          {/* Stats Cards Grid */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-2'>
              <div className='w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg'>
                <FaUsers />
              </div>
              <p className='text-xs font-semibold text-slate-500'>Registered Users</p>
              <p className='text-3xl font-black text-slate-900'>{stats.totalUsers}</p>
            </div>

            <div className='bg-white p-5 rounded-3xl border border-amber-200 bg-amber-50/30 shadow-2xs space-y-2'>
              <div className='w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg'>
                <FaClock />
              </div>
              <p className='text-xs font-semibold text-amber-800'>Pending Approval</p>
              <p className='text-3xl font-black text-amber-900'>{stats.pendingCount}</p>
            </div>

            <div className='bg-white p-5 rounded-3xl border border-emerald-200 bg-emerald-50/30 shadow-2xs space-y-2'>
              <div className='w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg'>
                <FaCheckCircle />
              </div>
              <p className='text-xs font-semibold text-emerald-800'>Approved Listings</p>
              <p className='text-3xl font-black text-emerald-900'>{stats.approvedCount}</p>
            </div>

            <div className='bg-white p-5 rounded-3xl border border-rose-200 bg-rose-50/30 shadow-2xs space-y-2'>
              <div className='w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg'>
                <FaFlag />
              </div>
              <p className='text-xs font-semibold text-rose-800'>Open Reports</p>
              <p className='text-3xl font-black text-rose-900'>{stats.openReportsCount}</p>
            </div>
          </div>

          {/* Quick Actions & Recent Pending */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            {/* Left: Pending Queue Preview */}
            <div className='lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='font-bold text-slate-900 text-base'>
                  Pending Submissions Awaiting Moderation ({stats.pendingCount})
                </h3>
                <button
                  type='button'
                  onClick={() => setActiveTab('pending')}
                  className='text-xs font-bold text-amber-600 hover:underline'
                >
                  View full queue →
                </button>
              </div>

              {pendingListings.length === 0 ? (
                <div className='p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500'>
                  No listings waiting for moderation. All caught up!
                </div>
              ) : (
                <div className='divide-y divide-slate-100'>
                  {pendingListings.slice(0, 4).map((item) => (
                    <div key={item.id} className='py-3.5 flex items-center justify-between gap-4'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <img
                          src={
                            Array.isArray(item.images) && item.images.length > 0
                              ? item.images[0]
                              : '/images/airbnb_apartment_living.jpg'
                          }
                          alt={item.title}
                          className='w-12 h-12 rounded-xl object-cover shrink-0'
                        />
                        <div className='min-w-0'>
                          <p className='font-bold text-slate-900 text-xs sm:text-sm truncate'>
                            {item.title}
                          </p>
                          <p className='text-[11px] text-slate-500 truncate'>
                            {item.type === 'guesthouse' ? 'Guest House' : 'Car Leasing'} • $
                            {item.price} • {item.ownerEmail}
                          </p>
                        </div>
                      </div>

                      <div className='flex items-center gap-1.5 shrink-0'>
                        <button
                          type='button'
                          onClick={() => setReviewingListing(item)}
                          className='px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition'
                        >
                          Review
                        </button>
                        <button
                          type='button'
                          onClick={() => handleApprove(item.id, item.title)}
                          className='px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition'
                        >
                          Approve
                        </button>
                        <button
                          type='button'
                          onClick={() => setRejectModalListing(item)}
                          className='px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition'
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Moderation Principles */}
            <div className='bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-4'>
              <h3 className='font-bold text-slate-900 text-sm'>Quality Standards</h3>
              <ul className='space-y-3 text-xs text-slate-600 leading-relaxed'>
                <li className='flex items-start gap-2'>
                  <FaCheck className='text-emerald-600 mt-0.5 shrink-0' />
                  <span>Images must be clear photos of the actual property or vehicle.</span>
                </li>
                <li className='flex items-start gap-2'>
                  <FaCheck className='text-emerald-600 mt-0.5 shrink-0' />
                  <span>Contact telephone and WhatsApp number must be valid for reservations.</span>
                </li>
                <li className='flex items-start gap-2'>
                  <FaCheck className='text-emerald-600 mt-0.5 shrink-0' />
                  <span>Rejection requires a constructive explanation provided to the host.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING REVIEW QUEUE */}
      {activeTab === 'pending' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-bold text-slate-900'>
              Pending Queue ({pendingListings.length})
            </h2>
          </div>

          {loadingPending ? (
            <div className='space-y-3'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-24 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : pendingListings.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl space-y-2'>
              <div className='w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl'>
                <FaCheck />
              </div>
              <h3 className='font-bold text-slate-900'>No Pending Listings</h3>
              <p className='text-xs text-slate-500'>
                All submitted listings have been reviewed and approved or rejected.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {pendingListings.map((item) => (
                <div
                  key={item.id}
                  className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4'
                >
                  <div className='flex items-center gap-4 min-w-0'>
                    <img
                      src={
                        Array.isArray(item.images) && item.images.length > 0
                          ? item.images[0]
                          : '/images/airbnb_apartment_living.jpg'
                      }
                      alt={item.title}
                      className='w-16 h-16 rounded-xl object-cover shrink-0'
                    />

                    <div className='min-w-0 space-y-1'>
                      <div className='flex items-center gap-2'>
                        <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white'>
                          {item.type === 'guesthouse' ? 'Guest House' : 'Car Leasing'}
                        </span>
                        <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900'>
                          Pending Review
                        </span>
                      </div>
                      <h4 className='font-bold text-slate-900 text-sm truncate'>{item.title}</h4>
                      <p className='text-xs text-slate-500 truncate'>
                        Host: {item.ownerEmail} • Phone: {item.contactPhone || 'N/A'} • Location:{' '}
                        {item.city}
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 shrink-0'>
                    <button
                      type='button'
                      onClick={() => setReviewingListing(item)}
                      className='px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5'
                    >
                      <FaEye />
                      <span>Review Details</span>
                    </button>

                    <button
                      type='button'
                      onClick={() => handleApprove(item.id, item.title)}
                      className='px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs'
                    >
                      <FaCheck />
                      <span>Approve</span>
                    </button>

                    <button
                      type='button'
                      onClick={() => setRejectModalListing(item)}
                      className='px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs'
                    >
                      <FaTimes />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ALL LISTINGS MANAGEMENT */}
      {activeTab === 'listings' && (
        <div className='space-y-4'>
          {/* Controls Bar */}
          <div className='bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4'>
            {/* Status Tabs */}
            <div className='flex items-center gap-1 overflow-x-auto'>
              {['all', 'approved', 'pending', 'rejected', 'archived'].map((st) => (
                <button
                  key={st}
                  type='button'
                  onClick={() => {
                    setStatusFilter(st);
                    loadAllListings(st);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className='relative w-full md:w-64'>
              <FaSearch className='absolute left-3 top-3 text-slate-400 text-xs' />
              <input
                type='text'
                placeholder='Search title, city, host...'
                value={listingSearchTerm}
                onChange={(e) => setListingSearchTerm(e.target.value)}
                className='w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          {loadingAllListings ? (
            <div className='space-y-3'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-20 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-xs text-slate-500'>
              No listings found for this filter.
            </div>
          ) : (
            <div className='bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider'>
                    <tr>
                      <th className='p-3.5'>Listing</th>
                      <th className='p-3.5'>Category</th>
                      <th className='p-3.5'>Price</th>
                      <th className='p-3.5'>Status</th>
                      <th className='p-3.5'>Host</th>
                      <th className='p-3.5 text-right'>Actions</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {filteredListings.map((item) => (
                      <tr key={item.id} className='hover:bg-slate-50/60 transition'>
                        <td className='p-3.5 font-bold text-slate-900 max-w-xs truncate'>
                          <Link to={`/listing/${item.id}`} className='hover:underline'>
                            {item.title}
                          </Link>
                          {item.featured && (
                            <span className='ml-2 text-amber-500 font-extrabold'>★ Featured</span>
                          )}
                        </td>
                        <td className='p-3.5'>
                          <span className='capitalize font-semibold'>
                            {item.type === 'guesthouse' ? 'Guest House' : 'Car Leasing'}
                          </span>
                        </td>
                        <td className='p-3.5 font-extrabold text-slate-900'>
                          ${item.price} / {item.priceUnit || 'day'}
                        </td>
                        <td className='p-3.5'>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : item.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className='p-3.5 text-slate-500 truncate max-w-[140px]'>
                          {item.ownerEmail}
                        </td>
                        <td className='p-3.5 text-right space-x-1 whitespace-nowrap'>
                          <button
                            type='button'
                            title='Toggle Featured'
                            onClick={() => handleToggleFeatured(item.id, item.featured, item.title)}
                            className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                              item.featured
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <FaStar />
                          </button>

                          <Link
                            to={`/update-listing/${item.id}?from=admin`}
                            className='inline-block p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs'
                            title='Edit'
                          >
                            <FaEdit />
                          </Link>

                          <button
                            type='button'
                            title='Archive'
                            onClick={() => handleArchive(item.id, item.title)}
                            className='p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs cursor-pointer'
                          >
                            <FaArchive />
                          </button>

                          <button
                            type='button'
                            title='Delete'
                            onClick={() => handleDelete(item.id, item.title)}
                            className='p-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs cursor-pointer'
                          >
                            <FaTrashAlt />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USERS TABLE */}
      {activeTab === 'users' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs'>
            <h2 className='text-sm font-bold text-slate-900'>
              All Registered Accounts ({users.length})
            </h2>

            <div className='relative w-full sm:w-64'>
              <FaSearch className='absolute left-3 top-3 text-slate-400 text-xs' />
              <input
                type='text'
                placeholder='Search email, name...'
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className='w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className='space-y-3'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-16 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-xs text-slate-500'>
              No users matching search query.
            </div>
          ) : (
            <div className='bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider'>
                    <tr>
                      <th className='p-3.5'>User</th>
                      <th className='p-3.5'>Email</th>
                      <th className='p-3.5'>Verified</th>
                      <th className='p-3.5'>Role</th>
                      <th className='p-3.5'>Status</th>
                      <th className='p-3.5'>Joined</th>
                      <th className='p-3.5 text-right'>Action</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className='hover:bg-slate-50/60 transition'>
                        <td className='p-3.5 font-bold text-slate-900'>
                          {u.displayName || u.email?.split('@')[0] || 'User'}
                        </td>
                        <td className='p-3.5 text-slate-600'>{u.email}</td>
                        <td className='p-3.5'>
                          {u.emailVerified ? (
                            <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800'>
                              Verified
                            </span>
                          ) : (
                            <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800'>
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className='p-3.5 font-semibold uppercase text-[11px]'>{u.role || 'user'}</td>
                        <td className='p-3.5'>
                          {u.disabled ? (
                            <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800'>
                              Disabled
                            </span>
                          ) : (
                            <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800'>
                              Active
                            </span>
                          )}
                        </td>
                        <td className='p-3.5 text-slate-400'>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className='p-3.5 text-right'>
                          {u.email !== 'jossvision11@gmail.com' && (
                            <button
                              type='button'
                              onClick={() => handleToggleUserDisabled(u)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                u.disabled
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              {u.disabled ? 'Enable User' : 'Disable User'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <div className='space-y-4'>
          <h2 className='text-sm font-bold text-slate-900'>User Reports Queue ({reports.length})</h2>

          {loadingReports ? (
            <div className='space-y-3'>
              {[1, 2].map((n) => (
                <div key={n} className='h-20 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-xs text-slate-500'>
              No community reports submitted.
            </div>
          ) : (
            <div className='space-y-3'>
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4'
                >
                  <div className='space-y-1 text-xs'>
                    <div className='flex items-center gap-2'>
                      <span className='font-bold text-slate-900'>Listing ID: {rep.listingId}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rep.status === 'open'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>
                    <p className='text-slate-700 font-medium'>Reason: &ldquo;{rep.reason}&rdquo;</p>
                    <p className='text-slate-400 text-[11px]'>
                      Reported by: {rep.reporterId} •{' '}
                      {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : ''}
                    </p>
                  </div>

                  <div className='flex items-center gap-2'>
                    <Link
                      to={`/listing/${rep.listingId}`}
                      className='px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold'
                    >
                      View Listing
                    </Link>
                    {rep.status === 'open' ? (
                      <button
                        type='button'
                        onClick={() => handleReportStatusChange(rep.id, 'resolved')}
                        className='px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition'
                      >
                        Mark Resolved
                      </button>
                    ) : (
                      <button
                        type='button'
                        onClick={() => handleReportStatusChange(rep.id, 'open')}
                        className='px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition'
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className='space-y-4'>
          <h2 className='text-sm font-bold text-slate-900'>
            Audit Log Entries ({auditLogs.length})
          </h2>

          {loadingAudit ? (
            <div className='space-y-3'>
              {[1, 2, 3].map((n) => (
                <div key={n} className='h-16 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-xs text-slate-500'>
              No audit logs recorded yet.
            </div>
          ) : (
            <div className='bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider'>
                    <tr>
                      <th className='p-3.5'>Timestamp</th>
                      <th className='p-3.5'>Action</th>
                      <th className='p-3.5'>Admin</th>
                      <th className='p-3.5'>Target ID</th>
                      <th className='p-3.5'>Details</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className='hover:bg-slate-50/60 transition'>
                        <td className='p-3.5 text-slate-400'>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                        </td>
                        <td className='p-3.5 font-bold text-slate-900'>{log.action}</td>
                        <td className='p-3.5 text-slate-600 font-mono text-[11px]'>
                          {log.adminId}
                        </td>
                        <td className='p-3.5 text-slate-600 font-mono text-[11px]'>
                          {log.targetId}
                        </td>
                        <td className='p-3.5 text-slate-600'>{log.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FULL LISTING REVIEW MODAL */}
      {reviewingListing && (
        <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn'>
          <div className='bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl'>
            <div className='flex items-center justify-between border-b border-slate-200 pb-3'>
              <div>
                <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white'>
                  {reviewingListing.type === 'guesthouse' ? 'Guest House' : 'Car Leasing'}
                </span>
                <h3 className='text-lg font-bold text-slate-900 mt-1'>
                  {reviewingListing.title}
                </h3>
              </div>
              <button
                type='button'
                onClick={() => setReviewingListing(null)}
                className='p-2 text-slate-400 hover:text-slate-800 rounded-full'
              >
                <FaTimes />
              </button>
            </div>

            {/* Photos */}
            {Array.isArray(reviewingListing.images) && reviewingListing.images.length > 0 && (
              <div className='grid grid-cols-3 gap-2'>
                {reviewingListing.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt='preview'
                    className='w-full h-24 object-cover rounded-xl border border-slate-200'
                  />
                ))}
              </div>
            )}

            {/* Details */}
            <div className='space-y-3 text-xs leading-relaxed'>
              <div>
                <span className='font-bold text-slate-700 block'>Description:</span>
                <p className='text-slate-600 whitespace-pre-line'>
                  {reviewingListing.description}
                </p>
              </div>

              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl'>
                <div>
                  <span className='font-bold text-slate-700 block'>Rate:</span>
                  <span className='text-slate-900 font-extrabold'>
                    ${reviewingListing.price} / {reviewingListing.priceUnit}
                  </span>
                </div>
                <div>
                  <span className='font-bold text-slate-700 block'>Location:</span>
                  <span className='text-slate-900'>{reviewingListing.city}</span>
                </div>
                <div>
                  <span className='font-bold text-slate-700 block'>Contact:</span>
                  <span className='text-slate-900'>{reviewingListing.contactPhone}</span>
                </div>
              </div>

              {reviewingListing.type === 'guesthouse' ? (
                <div className='space-y-1 text-slate-600'>
                  <p>
                    Bedrooms: <strong>{reviewingListing.bedrooms}</strong> • Bathrooms:{' '}
                    <strong>{reviewingListing.bathrooms}</strong> • Max Guests:{' '}
                    <strong>{reviewingListing.maxGuests}</strong>
                  </p>
                  <p>Amenities: {reviewingListing.amenities?.join(', ') || 'None listed'}</p>
                </div>
              ) : (
                <div className='space-y-1 text-slate-600'>
                  <p>
                    Vehicle: <strong>{reviewingListing.make} {reviewingListing.model} ({reviewingListing.year})</strong>
                  </p>
                  <p>
                    Transmission: <strong>{reviewingListing.transmission}</strong> • Fuel:{' '}
                    <strong>{reviewingListing.fuel}</strong> • Seats:{' '}
                    <strong>{reviewingListing.seats}</strong>
                  </p>
                  <p>
                    Driver Included:{' '}
                    <strong>{reviewingListing.driverIncluded ? 'Yes' : 'No'}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className='flex items-center justify-end gap-3 pt-3 border-t border-slate-200'>
              <button
                type='button'
                onClick={() => setReviewingListing(null)}
                className='px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition'
              >
                Close
              </button>

              <button
                type='button'
                onClick={() => {
                  setRejectModalListing(reviewingListing);
                }}
                className='px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition'
              >
                Reject with Reason
              </button>

              <button
                type='button'
                onClick={() => handleApprove(reviewingListing.id, reviewingListing.title)}
                className='px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs'
              >
                Approve Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL WITH MANDATORY REASON */}
      {rejectModalListing && (
        <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn'>
          <div className='bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl'>
            <div className='flex items-center justify-between'>
              <h3 className='font-bold text-slate-900 text-base'>
                Reject &ldquo;{rejectModalListing.title}&rdquo;
              </h3>
              <button
                type='button'
                onClick={() => setRejectModalListing(null)}
                className='text-slate-400 hover:text-slate-700'
              >
                <FaTimes />
              </button>
            </div>

            <p className='text-xs text-slate-500 leading-relaxed'>
              A rejection reason is strictly required. This feedback will be sent to the listing host so they can revise their listing.
            </p>

            <form onSubmit={handleRejectSubmit} className='space-y-4'>
              <textarea
                required
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder='e.g. Please provide clearer photos of the interior or verify the contact phone number...'
                className='w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900'
              />

              <div className='flex items-center gap-2 justify-end'>
                <button
                  type='button'
                  onClick={() => setRejectModalListing(null)}
                  className='px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={rejecting || !rejectReason.trim()}
                  className='px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50'
                >
                  {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
