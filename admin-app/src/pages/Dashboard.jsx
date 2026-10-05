import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import ListingModal from '../components/ListingModal';
import CreateListingModal from '../components/CreateListingModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Active Tab: default to 'all' so EVERY listing appears on the list immediately
  const [activeTab, setActiveTab] = useState('all');

  // Pending listings state
  const [pendingListings, setPendingListings] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState(null);

  // All listings state (approved + pending + rejected)
  const [allListings, setAllListings] = useState([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allError, setAllError] = useState(null);

  // Filter & Search state for All Listings tab
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'pending' | 'rejected'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [actionLoading, setActionLoading] = useState(null); // { id, action: 'approve' | 'reject' }
  const [toggleLoadingId, setToggleLoadingId] = useState(null); // listing ID currently being toggled
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [inspectListing, setInspectListing] = useState(null);

  // Add & Delete Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingListing, setDeletingListing] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const getAuthHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
    ...(user?._id ? { 'x-user-id': user._id } : {}),
    ...(user?.email ? { 'x-user-email': user.email } : {}),
    'x-user-role': 'admin',
    'x-admin-auth': 'true',
  }), [user]);

  const handleSignOut = async () => {
    await logout();
    const loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    navigate(loginPath, { replace: true });
  };

  // Fetch Pending Listings
  const fetchPendingListings = useCallback(async (isSilent = false) => {
    if (!isSilent) setPendingLoading(true);
    setPendingError(null);
    try {
      const res = await fetch('/api/admin/listings/pending', {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to fetch pending listings (${res.status})`);
      }

      const data = await res.json();
      setPendingListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch pending listings error:', err);
      setPendingError(err.message || 'Unable to load pending listings.');
    } finally {
      if (!isSilent) setPendingLoading(false);
    }
  }, [getAuthHeaders]);

  // Fetch All Listings (Approved + Pending + Rejected)
  const fetchAllListings = useCallback(async (isSilent = false) => {
    if (!isSilent) setAllLoading(true);
    setAllError(null);
    try {
      let res = await fetch('/api/admin/listings/all', {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        // Fallback to /api/admin/listings
        res = await fetch('/api/admin/listings', {
          method: 'GET',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to fetch all listings (${res.status})`);
      }

      const data = await res.json();
      setAllListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch all listings error:', err);
      setAllError(err.message || 'Unable to load all listings.');
    } finally {
      if (!isSilent) setAllLoading(false);
    }
  }, [getAuthHeaders]);

  // Initial load
  useEffect(() => {
    fetchPendingListings();
    fetchAllListings();
  }, [fetchPendingListings, fetchAllListings]);

  // Handle Approve
  const handleApprove = async (id, title) => {
    setActionLoading({ id, action: 'approve' });
    try {
      const res = await fetch(`/api/admin/listings/${id}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Failed to approve listing (${res.status})`);
      }

      showToast(`Listing "${title || id}" approved successfully!`, 'success');

      // Update in both lists locally & refresh
      setPendingListings((prev) => prev.filter((item) => item._id !== id));
      setAllListings((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status: 'approved', isApproved: true } : item))
      );
      if (inspectListing && inspectListing._id === id) {
        setInspectListing((prev) => ({ ...prev, status: 'approved', isApproved: true }));
      }
      fetchPendingListings(true);
      fetchAllListings(true);
    } catch (err) {
      console.error('Approve listing error:', err);
      showToast(err.message || 'Failed to approve listing.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Reject
  const handleReject = async (id, title) => {
    setActionLoading({ id, action: 'reject' });
    try {
      const res = await fetch(`/api/admin/listings/${id}/reject`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Failed to reject listing (${res.status})`);
      }

      showToast(`Listing "${title || id}" rejected successfully!`, 'success');

      // Update in both lists locally & refresh
      setPendingListings((prev) => prev.filter((item) => item._id !== id));
      setAllListings((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status: 'rejected', isApproved: false } : item))
      );
      if (inspectListing && inspectListing._id === id) {
        setInspectListing((prev) => ({ ...prev, status: 'rejected', isApproved: false }));
      }
      fetchPendingListings(true);
      fetchAllListings(true);
    } catch (err) {
      console.error('Reject listing error:', err);
      showToast(err.message || 'Failed to reject listing.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (id, currentActive, title) => {
    setToggleLoadingId(id);
    try {
      const res = await fetch(`/api/admin/listings/${id}/toggle-active`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Failed to toggle active status (${res.status})`);
      }

      const newActive = data.active !== undefined ? data.active : !currentActive;
      showToast(
        `Listing "${title || id}" is now ${newActive ? 'Active' : 'Inactive'}.`,
        'success'
      );

      // Update all listings state
      setAllListings((prev) =>
        prev.map((item) => (item._id === id ? { ...item, active: newActive, isActive: newActive } : item))
      );
      // Update pending list state if present
      setPendingListings((prev) =>
        prev.map((item) => (item._id === id ? { ...item, active: newActive, isActive: newActive } : item))
      );
      // Update modal if currently inspecting
      if (inspectListing && inspectListing._id === id) {
        setInspectListing((prev) => ({ ...prev, active: newActive, isActive: newActive }));
      }
    } catch (err) {
      console.error('Toggle active error:', err);
      showToast(err.message || 'Failed to toggle active status.', 'error');
    } finally {
      setToggleLoadingId(null);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingListing) return;
    const id = deletingListing._id;
    const title = deletingListing.title || deletingListing.name || 'Listing';

    try {
      setIsDeleting(true);
      let res = await fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        res = await fetch(`/api/listing/delete/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Failed to delete listing (${res.status})`);
      }

      showToast(`Listing "${title}" permanently deleted.`, 'success');
      setAllListings((prev) => prev.filter((item) => item._id !== id));
      setPendingListings((prev) => prev.filter((item) => item._id !== id));
      if (inspectListing && inspectListing._id === id) {
        setInspectListing(null);
      }
      setDeletingListing(null);
    } catch (err) {
      console.error('Delete listing error:', err);
      showToast(err.message || 'Failed to delete listing.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Listing Created
  const handleListingCreated = (newListing) => {
    showToast(`Listing "${newListing.title || newListing.name}" created successfully!`, 'success');
    setAllListings((prev) => [newListing, ...prev]);
    if (newListing.status === 'pending' || newListing.isApproved === false) {
      setPendingListings((prev) => [newListing, ...prev]);
    }
    // Refresh directory silently
    fetchAllListings(true);
    fetchPendingListings(true);
  };

  // Filtered All Listings
  const filteredAllListings = useMemo(() => {
    return allListings.filter((item) => {
      // Status filter
      if (statusFilter !== 'all') {
        const itemStatus = item.status || 'pending';
        if (itemStatus !== statusFilter) return false;
      }

      // Active filter
      if (activeFilter === 'active' && item.active === false) return false;
      if (activeFilter === 'inactive' && item.active !== false) return false;

      // Search query
      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = String(item?.title || item?.name || '').toLowerCase();
        const loc = String(item?.location || item?.address || '').toLowerCase();
        const cat = String(item?.category || item?.type || '').toLowerCase();
        if (!title.includes(query) && !loc.includes(query) && !cat.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [allListings, statusFilter, activeFilter, searchQuery]);

  // Statistics for badges
  const stats = useMemo(() => {
    const total = allListings.length;
    const active = allListings.filter((i) => i.active !== false).length;
    const inactive = total - active;
    const approved = allListings.filter((i) => i.status === 'approved').length;
    const pending = allListings.filter((i) => i.status === 'pending' || !i.status).length;
    const rejected = allListings.filter((i) => i.status === 'rejected').length;
    return { total, active, inactive, approved, pending, rejected };
  }, [allListings]);

  return (
    <div className='min-h-screen bg-slate-100 flex flex-col font-sans'>
      {/* Toast notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Listing Inspection Modal */}
      <ListingModal
        listing={inspectListing}
        onClose={() => setInspectListing(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onToggleActive={handleToggleActive}
        onDelete={(item) => setDeletingListing(item)}
        actionLoading={actionLoading}
        isTogglingActive={inspectListing && toggleLoadingId === inspectListing._id}
      />

      {/* Add New Listing Modal */}
      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleListingCreated}
        authHeaders={getAuthHeaders}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deletingListing}
        listing={deletingListing}
        onClose={() => setDeletingListing(null)}
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
      />

      {/* Top Navbar */}
      <header className='bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-20 shadow-xs'>
        <div className='max-w-7xl mx-auto flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-lg bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-xs'>
              C
            </div>
            <div>
              <span className='font-bold text-slate-800 text-base tracking-tight'>
                Chento100
              </span>
              <span className='ml-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 rounded border border-slate-200'>
                Admin
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3 sm:gap-4'>
            <button
              type='button'
              id='admin-add-listing-header-btn'
              onClick={() => setIsCreateModalOpen(true)}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors'
            >
              <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 4v16m8-8H4' />
              </svg>
              <span>+ Add Listing</span>
            </button>

            {user && (
              <div className='flex items-center gap-2.5 text-sm'>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt='Avatar'
                    className='w-8 h-8 rounded-full object-cover border border-slate-200'
                  />
                ) : (
                  <div className='w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center'>
                    {(user.username || 'A')[0].toUpperCase()}
                  </div>
                )}
                <div className='hidden sm:flex flex-col text-left'>
                  <span className='font-semibold text-slate-800 text-xs'>
                    {user.username || 'Admin User'}
                  </span>
                  <span className='text-slate-500 text-[11px]'>{user.email}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleSignOut}
              id='admin-signout-btn'
              className='text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors'
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className='flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8'>
        {/* Top Navigation Tabs Header */}
        <div className='flex items-center justify-between border-b border-slate-200 pb-4 mb-6'>
          <div className='flex items-center gap-2 sm:gap-3'>
            <button
              type='button'
              id='tab-all-listings'
              onClick={() => setActiveTab('all')}
              className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>All Listings Directory</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {allListings.length}
              </span>
            </button>

            <button
              type='button'
              id='tab-pending-listings'
              onClick={() => setActiveTab('pending')}
              className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Pending Moderation</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'pending'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {pendingListings.length}
              </span>
            </button>
          </div>

          <div className='hidden sm:flex items-center gap-2'>
            <span className='text-xs text-slate-500 font-medium'>
              Platform Status: <span className='text-emerald-600 font-bold'>Operational</span>
            </span>
          </div>
        </div>

        {/* TAB 1: PENDING LISTINGS MODERATION */}
        {activeTab === 'pending' && (
          <section id='section-pending-moderation' aria-label='Pending Listings Moderation'>
            {/* Summary Header Card */}
            <div className='bg-white rounded-xl border border-slate-200 p-6 shadow-xs mb-6'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                  <div className='flex items-center gap-2.5'>
                    <h1 className='text-2xl font-bold text-slate-900'>Listing Moderation</h1>
                    <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200'>
                      {pendingListings.length} Pending
                    </span>
                  </div>
                  <p className='text-sm text-slate-500 mt-1'>
                    Review, inspect, approve, or reject newly submitted guest houses and chauffeured vehicles.
                  </p>
                </div>

                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    id='refresh-pending-listings-btn'
                    onClick={() => fetchPendingListings(false)}
                    disabled={pendingLoading}
                    className='inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-xs disabled:opacity-50'
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-slate-600 ${pendingLoading ? 'animate-spin' : ''}`}
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                      />
                    </svg>
                    <span>{pendingLoading ? 'Refreshing...' : 'Refresh List'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {pendingError && (
              <div
                id='pending-listings-error'
                className='mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center justify-between'
              >
                <div className='flex items-center gap-2.5'>
                  <svg className='w-5 h-5 text-rose-500 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                  <span>{pendingError}</span>
                </div>
                <button
                  onClick={() => fetchPendingListings()}
                  className='text-xs font-semibold underline hover:no-underline ml-4'
                >
                  Retry
                </button>
              </div>
            )}

            {/* Content Section: Table / Cards */}
            <div className='bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden'>
              {pendingLoading ? (
                <div className='p-12 flex flex-col items-center justify-center text-center'>
                  <div className='w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-3'></div>
                  <p className='text-sm text-slate-600 font-medium'>Loading pending listings...</p>
                  <p className='text-xs text-slate-400 mt-1'>Fetching from /api/admin/listings/pending</p>
                </div>
              ) : pendingListings.length === 0 ? (
                <div
                  id='empty-pending-state'
                  className='p-16 flex flex-col items-center justify-center text-center'
                >
                  <div className='w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4'>
                    <svg className='w-7 h-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                    </svg>
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 mb-1'>All Caught Up!</h3>
                  <p className='text-sm text-slate-500 max-w-sm'>
                    There are currently no pending listings awaiting administrative review.
                  </p>
                  <button
                    onClick={() => fetchPendingListings()}
                    className='mt-4 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors'
                  >
                    Check Again
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className='hidden md:block overflow-x-auto'>
                    <table id='pending-listings-table' className='w-full text-left text-sm text-slate-700'>
                      <thead className='bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200'>
                        <tr>
                          <th scope='col' className='py-3.5 px-5 font-semibold'>Listing</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Category</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Location</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Rate</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Submitted</th>
                          <th scope='col' className='py-3.5 px-5 font-semibold text-right'>Actions</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {pendingListings.map((item) => {
                          const isCar = item.category === 'car' || item.type === 'sale';
                          const title = item.title || item.name || 'Untitled Listing';
                          const price = item.regularPrice || item.price || 0;
                          const thumb =
                            item.imageUrls && item.imageUrls[0]
                              ? item.imageUrls[0]
                              : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80';
                          const isActing = actionLoading && actionLoading.id === item._id;

                          return (
                            <tr
                              key={item._id}
                              id={'listing-row-' + item._id}
                              className='hover:bg-slate-50/75 transition-colors'
                            >
                              <td className='py-4 px-5'>
                                <div className='flex items-center gap-3.5'>
                                  <img
                                    src={thumb}
                                    alt={title}
                                    className='w-14 h-12 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer'
                                    onClick={() => setInspectListing(item)}
                                  />
                                  <div className='max-w-xs'>
                                    <button
                                      type='button'
                                      onClick={() => setInspectListing(item)}
                                      className='font-semibold text-slate-900 hover:text-slate-700 text-left line-clamp-1'
                                    >
                                      {title}
                                    </button>
                                    <p className='text-xs text-slate-400 line-clamp-1 mt-0.5'>
                                      {item.description || 'No description provided.'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap'>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isCar
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {isCar ? 'Chauffeur Car' : 'Guest House'}
                                </span>
                              </td>

                              <td className='py-4 px-4 text-xs text-slate-600 max-w-xs truncate'>
                                {item.location || item.address || '—'}
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap'>
                                <span className='font-bold text-slate-900'>${price}</span>
                                <span className='text-slate-400 text-xs'>
                                  {isCar ? '/day' : '/night'}
                                </span>
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap text-xs text-slate-500'>
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : 'Recent'}
                              </td>

                              <td className='py-4 px-5 text-right whitespace-nowrap'>
                                <div className='inline-flex items-center gap-2'>
                                  <button
                                    type='button'
                                    id={'inspect-btn-' + item._id}
                                    onClick={() => setInspectListing(item)}
                                    className='p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors'
                                    title='Inspect Details'
                                  >
                                    <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                                    </svg>
                                  </button>

                                  <button
                                    type='button'
                                    id={'pending-delete-btn-' + item._id}
                                    onClick={() => setDeletingListing(item)}
                                    className='p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors'
                                    title='Delete Listing'
                                  >
                                    <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                                    </svg>
                                  </button>

                                  <button
                                    type='button'
                                    id={'reject-btn-' + item._id}
                                    disabled={isActing}
                                    onClick={() => handleReject(item._id, title)}
                                    className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50'
                                  >
                                    {isActing && actionLoading.action === 'reject'
                                      ? 'Rejecting...'
                                      : 'Reject'}
                                  </button>

                                  <button
                                    type='button'
                                    id={'approve-btn-' + item._id}
                                    disabled={isActing}
                                    onClick={() => handleApprove(item._id, title)}
                                    className='px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs disabled:opacity-50'
                                  >
                                    {isActing && actionLoading.action === 'approve'
                                      ? 'Approving...'
                                      : 'Approve'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View */}
                  <div className='md:hidden divide-y divide-slate-100'>
                    {pendingListings.map((item) => {
                      const isCar = item.category === 'car' || item.type === 'sale';
                      const title = item.title || item.name || 'Untitled Listing';
                      const price = item.regularPrice || item.price || 0;
                      const thumb =
                        item.imageUrls && item.imageUrls[0]
                          ? item.imageUrls[0]
                          : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80';
                      const isActing = actionLoading && actionLoading.id === item._id;

                      return (
                        <div key={item._id} className='p-4 flex flex-col gap-3'>
                          <div className='flex gap-3'>
                            <img
                              src={thumb}
                              alt={title}
                              className='w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0'
                              onClick={() => setInspectListing(item)}
                            />
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center gap-1.5 mb-1'>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                    isCar
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {isCar ? 'Car' : 'Guesthouse'}
                                </span>
                                <span className='text-xs font-bold text-slate-800 ml-auto'>
                                  ${price}
                                  <span className='text-[10px] font-normal text-slate-500'>
                                    {isCar ? '/day' : '/night'}
                                  </span>
                                </span>
                              </div>
                              <h3
                                onClick={() => setInspectListing(item)}
                                className='text-sm font-semibold text-slate-900 truncate cursor-pointer'
                              >
                                {title}
                              </h3>
                              <p className='text-xs text-slate-500 truncate mt-0.5'>
                                {item.location || item.address || 'Location unspecified'}
                              </p>
                            </div>
                          </div>

                          <div className='flex items-center gap-2 pt-1'>
                            <button
                              type='button'
                              onClick={() => setInspectListing(item)}
                              className='flex-1 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors'
                            >
                              Details
                            </button>

                            <button
                              type='button'
                              onClick={() => setDeletingListing(item)}
                              className='px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors'
                            >
                              Delete
                            </button>

                            <button
                              type='button'
                              disabled={isActing}
                              onClick={() => handleReject(item._id, title)}
                              className='flex-1 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50'
                            >
                              {isActing && actionLoading.action === 'reject' ? 'Rejecting...' : 'Reject'}
                            </button>

                            <button
                              type='button'
                              disabled={isActing}
                              onClick={() => handleApprove(item._id, title)}
                              className='flex-1 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs disabled:opacity-50'
                            >
                              {isActing && actionLoading.action === 'approve' ? 'Approving...' : 'Approve'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* TAB 2: ALL LISTINGS INVENTORY & ACTIVE TOGGLE */}
        {activeTab === 'all' && (
          <section id='section-all-listings' aria-label='All Listings Directory'>
            {/* Summary & Stats Header Card */}
            <div className='bg-white rounded-xl border border-slate-200 p-6 shadow-xs mb-6'>
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-6'>
                <div>
                  <div className='flex items-center gap-2.5'>
                    <h1 className='text-2xl font-bold text-slate-900'>All Listings Directory</h1>
                    <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200'>
                      {allListings.length} Total
                    </span>
                  </div>
                  <p className='text-sm text-slate-500 mt-1'>
                    Complete overview of approved, pending, and rejected guest houses and chauffeur cars. Toggle the active field to enable or disable public booking visibility.
                  </p>
                </div>

                <div className='flex items-center gap-3 self-start lg:self-center'>
                  <button
                    type='button'
                    id='admin-add-listing-directory-btn'
                    onClick={() => setIsCreateModalOpen(true)}
                    className='inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs'
                  >
                    <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M12 4v16m8-8H4' />
                    </svg>
                    <span>+ Add New Listing</span>
                  </button>

                  <button
                    type='button'
                    id='refresh-all-listings-btn'
                    onClick={() => fetchAllListings(false)}
                    disabled={allLoading}
                    className='inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-xs disabled:opacity-50'
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-slate-600 ${allLoading ? 'animate-spin' : ''}`}
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                      />
                    </svg>
                    <span>{allLoading ? 'Refreshing...' : 'Refresh Directory'}</span>
                  </button>
                </div>
              </div>

              {/* Status Overview Metric Pills */}
              <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100'>
                <div className='bg-slate-50 p-3 rounded-xl border border-slate-100'>
                  <span className='text-[10px] font-semibold uppercase text-slate-400 block'>Total Listings</span>
                  <span className='text-lg font-bold text-slate-800'>{stats.total}</span>
                </div>
                <div className='bg-emerald-50/70 p-3 rounded-xl border border-emerald-100'>
                  <span className='text-[10px] font-semibold uppercase text-emerald-600 block'>Active Listings</span>
                  <span className='text-lg font-bold text-emerald-800'>{stats.active}</span>
                </div>
                <div className='bg-slate-50 p-3 rounded-xl border border-slate-200/80'>
                  <span className='text-[10px] font-semibold uppercase text-slate-500 block'>Inactive Listings</span>
                  <span className='text-lg font-bold text-slate-700'>{stats.inactive}</span>
                </div>
                <div className='bg-blue-50/70 p-3 rounded-xl border border-blue-100'>
                  <span className='text-[10px] font-semibold uppercase text-blue-600 block'>Approved</span>
                  <span className='text-lg font-bold text-blue-800'>{stats.approved}</span>
                </div>
                <div className='bg-amber-50/70 p-3 rounded-xl border border-amber-100'>
                  <span className='text-[10px] font-semibold uppercase text-amber-600 block'>Pending</span>
                  <span className='text-lg font-bold text-amber-800'>{stats.pending}</span>
                </div>
                <div className='bg-rose-50/70 p-3 rounded-xl border border-rose-100'>
                  <span className='text-[10px] font-semibold uppercase text-rose-600 block'>Rejected</span>
                  <span className='text-lg font-bold text-rose-800'>{stats.rejected}</span>
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {allError && (
              <div
                id='all-listings-error'
                className='mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center justify-between'
              >
                <div className='flex items-center gap-2.5'>
                  <svg className='w-5 h-5 text-rose-500 shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                  <span>{allError}</span>
                </div>
                <button
                  onClick={() => fetchAllListings()}
                  className='text-xs font-semibold underline hover:no-underline ml-4'
                >
                  Retry
                </button>
              </div>
            )}

            {/* Filters and Search Bar */}
            <div className='bg-white rounded-xl border border-slate-200 p-4 shadow-xs mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4'>
              <div className='relative flex-1 max-w-md'>
                <div className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400'>
                  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                  </svg>
                </div>
                <input
                  type='text'
                  id='search-all-listings-input'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search by title, location, category...'
                  className='w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-800 focus:bg-white transition-all text-slate-800 placeholder-slate-400'
                />
                {searchQuery && (
                  <button
                    type='button'
                    onClick={() => setSearchQuery('')}
                    className='absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600'
                  >
                    <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                )}
              </div>

              <div className='flex items-center gap-3 flex-wrap'>
                {/* Moderation Status Filter */}
                <div className='inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold'>
                  <button
                    type='button'
                    id='filter-status-all'
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    type='button'
                    id='filter-status-approved'
                    onClick={() => setStatusFilter('approved')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === 'approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    type='button'
                    id='filter-status-pending'
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type='button'
                    id='filter-status-rejected'
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === 'rejected' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Rejected
                  </button>
                </div>

                {/* Active Filter */}
                <div className='inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold'>
                  <button
                    type='button'
                    id='filter-active-all'
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      activeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Active
                  </button>
                  <button
                    type='button'
                    id='filter-active-active'
                    onClick={() => setActiveFilter('active')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      activeFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Active Only
                  </button>
                  <button
                    type='button'
                    id='filter-active-inactive'
                    onClick={() => setActiveFilter('inactive')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      activeFilter === 'inactive' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Inactive Only
                  </button>
                </div>
              </div>
            </div>

            {/* Content Section: Table / Cards */}
            <div className='bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden'>
              {allLoading ? (
                <div className='p-12 flex flex-col items-center justify-center text-center'>
                  <div className='w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-3'></div>
                  <p className='text-sm text-slate-600 font-medium'>Loading complete listing inventory...</p>
                  <p className='text-xs text-slate-400 mt-1'>Fetching from /api/admin/listings/all</p>
                </div>
              ) : filteredAllListings.length === 0 ? (
                <div id='empty-all-listings-state' className='p-16 flex flex-col items-center justify-center text-center'>
                  <div className='w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4'>
                    <svg className='w-7 h-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                    </svg>
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 mb-1'>No Listings Found</h3>
                  <p className='text-sm text-slate-500 max-w-sm'>
                    No listings match the current filters or search criteria.
                  </p>
                  {(statusFilter !== 'all' || activeFilter !== 'all' || searchQuery) && (
                    <button
                      type='button'
                      onClick={() => {
                        setStatusFilter('all');
                        setActiveFilter('all');
                        setSearchQuery('');
                      }}
                      className='mt-4 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors'
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className='hidden md:block overflow-x-auto'>
                    <table id='all-listings-table' className='w-full text-left text-sm text-slate-700'>
                      <thead className='bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200'>
                        <tr>
                          <th scope='col' className='py-3.5 px-5 font-semibold'>Listing</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Category</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Status</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold'>Rate</th>
                          <th scope='col' className='py-3.5 px-4 font-semibold text-center'>Active Toggle</th>
                          <th scope='col' className='py-3.5 px-5 font-semibold text-right'>Details</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-slate-100'>
                        {filteredAllListings.map((item) => {
                          const isCar = item.category === 'car' || item.type === 'sale';
                          const title = item.title || item.name || 'Untitled Listing';
                          const price = item.regularPrice || item.price || 0;
                          const thumb =
                            item.imageUrls && item.imageUrls[0]
                              ? item.imageUrls[0]
                              : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80';
                          const status = item.status || 'pending';
                          const isActive = item.active !== false;
                          const isToggling = toggleLoadingId === item._id;

                          return (
                            <tr
                              key={item._id}
                              id={'all-listing-row-' + item._id}
                              className='hover:bg-slate-50/75 transition-colors'
                            >
                              <td className='py-4 px-5'>
                                <div className='flex items-center gap-3.5'>
                                  <img
                                    src={thumb}
                                    alt={title}
                                    className='w-14 h-12 rounded-lg object-cover border border-slate-200 shrink-0 cursor-pointer'
                                    onClick={() => setInspectListing(item)}
                                  />
                                  <div className='max-w-xs'>
                                    <button
                                      type='button'
                                      onClick={() => setInspectListing(item)}
                                      className='font-semibold text-slate-900 hover:text-slate-700 text-left line-clamp-1'
                                    >
                                      {title}
                                    </button>
                                    <p className='text-xs text-slate-400 line-clamp-1 mt-0.5'>
                                      {item.location || item.address || 'Address unspecified'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap'>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    isCar
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {isCar ? 'Chauffeur Car' : 'Guest House'}
                                </span>
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap'>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                                    status === 'approved'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : status === 'rejected'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>

                              <td className='py-4 px-4 whitespace-nowrap'>
                                <span className='font-bold text-slate-900'>${price}</span>
                                <span className='text-slate-400 text-xs'>
                                  {isCar ? '/day' : '/night'}
                                </span>
                              </td>

                              {/* TOGGLE ACTIVE COLUMN */}
                              <td className='py-4 px-4 whitespace-nowrap text-center'>
                                <div className='inline-flex items-center gap-2.5'>
                                  <button
                                    type='button'
                                    role='switch'
                                    aria-checked={isActive}
                                    id={'toggle-active-btn-' + item._id}
                                    disabled={isToggling}
                                    onClick={() => handleToggleActive(item._id, item.active, title)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                                      isActive ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-300 hover:bg-slate-400'
                                    }`}
                                    title={isActive ? 'Click to deactivate' : 'Click to activate'}
                                  >
                                    <span className='sr-only'>
                                      {isActive ? 'Deactivate listing' : 'Activate listing'}
                                    </span>
                                    <span
                                      aria-hidden='true'
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        isActive ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>

                                  <span
                                    className={`text-xs font-semibold min-w-[52px] text-left ${
                                      isToggling
                                        ? 'text-slate-400'
                                        : isActive
                                        ? 'text-emerald-700'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {isToggling ? 'Saving...' : isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </td>

                              <td className='py-4 px-5 text-right whitespace-nowrap'>
                                <div className='inline-flex items-center gap-2 justify-end'>
                                  <button
                                    type='button'
                                    id={'inspect-all-btn-' + item._id}
                                    onClick={() => setInspectListing(item)}
                                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors'
                                  >
                                    <span>Inspect</span>
                                    <svg className='w-3.5 h-3.5 text-slate-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                                    </svg>
                                  </button>

                                  <button
                                    type='button'
                                    id={'all-delete-btn-' + item._id}
                                    onClick={() => setDeletingListing(item)}
                                    className='p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors'
                                    title='Delete Listing permanently'
                                  >
                                    <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className='md:hidden divide-y divide-slate-100'>
                    {filteredAllListings.map((item) => {
                      const isCar = item.category === 'car' || item.type === 'sale';
                      const title = item.title || item.name || 'Untitled Listing';
                      const price = item.regularPrice || item.price || 0;
                      const thumb =
                        item.imageUrls && item.imageUrls[0]
                          ? item.imageUrls[0]
                          : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80';
                      const status = item.status || 'pending';
                      const isActive = item.active !== false;
                      const isToggling = toggleLoadingId === item._id;

                      return (
                        <div key={item._id} className='p-4 flex flex-col gap-3'>
                          <div className='flex gap-3'>
                            <img
                              src={thumb}
                              alt={title}
                              className='w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0'
                              onClick={() => setInspectListing(item)}
                            />
                            <div className='flex-1 min-w-0'>
                              <div className='flex items-center gap-1.5 mb-1 flex-wrap'>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                    isCar
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {isCar ? 'Car' : 'Guesthouse'}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                                    status === 'approved'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : status === 'rejected'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {status}
                                </span>

                                <span className='text-xs font-bold text-slate-800 ml-auto'>
                                  ${price}
                                  <span className='text-[10px] font-normal text-slate-500'>
                                    {isCar ? '/day' : '/night'}
                                  </span>
                                </span>
                              </div>

                              <h3
                                onClick={() => setInspectListing(item)}
                                className='text-sm font-semibold text-slate-900 truncate cursor-pointer'
                              >
                                {title}
                              </h3>
                              <p className='text-xs text-slate-500 truncate mt-0.5'>
                                {item.location || item.address || 'Location unspecified'}
                              </p>
                            </div>
                          </div>

                          {/* Mobile Active Toggle Bar */}
                          <div className='flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200'>
                            <div className='flex items-center gap-2'>
                              <span className='text-xs font-semibold text-slate-700'>
                                Visibility Status:
                              </span>
                              <span
                                className={`text-xs font-bold ${
                                  isActive ? 'text-emerald-700' : 'text-slate-500'
                                }`}
                              >
                                {isToggling ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>

                            <button
                              type='button'
                              role='switch'
                              aria-checked={isActive}
                              id={'mobile-toggle-active-btn-' + item._id}
                              disabled={isToggling}
                              onClick={() => handleToggleActive(item._id, item.active, title)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                                isActive ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              <span className='sr-only'>Toggle active</span>
                              <span
                                aria-hidden='true'
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <div className='flex items-center gap-2'>
                            <button
                              type='button'
                              onClick={() => setInspectListing(item)}
                              className='flex-1 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors'
                            >
                              View Details
                            </button>
                            <button
                              type='button'
                              onClick={() => setDeletingListing(item)}
                              className='px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors'
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
