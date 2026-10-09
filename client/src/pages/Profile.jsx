import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHome,
  FaCar,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaEye,
  FaSignOutAlt,
  FaCamera,
  FaShieldAlt,
  FaClock,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getUserListings, deleteListing } from '../services/listingService';
import { compressImage } from '../utils/imageCompressor';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../firebase';

export default function Profile() {
  const { t } = useLanguage();
  const {
    currentUser,
    userProfile,
    isEmailVerified,
    isAdmin,
    updateUser,
    logOut,
    resendVerification,
    refreshUserData,
  } = useAuth();
  const navigate = useNavigate();

  // Active section tab: 'listings' | 'settings'
  const [activeTab, setActiveTab] = useState('listings');

  // Listings State
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Email Verification State
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState(null);

  const fileInputRef = useRef(null);

  // Sync profile data
  useEffect(() => {
    if (currentUser) {
      setDisplayName(userProfile?.displayName || currentUser.displayName || '');
      setPhone(userProfile?.phone || '');
      setAvatarUrl(currentUser.photoURL || userProfile?.avatar || '');
    }
  }, [currentUser, userProfile]);

  // Load user listings
  useEffect(() => {
    let isMounted = true;
    async function fetchUserListings() {
      if (!currentUser?.uid) return;
      setLoadingListings(true);
      try {
        const userDocs = await getUserListings(currentUser.uid);
        if (isMounted) setListings(userDocs || []);
      } catch (err) {
        console.warn('Failed to load user listings:', err.message);
      } finally {
        if (isMounted) setLoadingListings(false);
      }
    }

    fetchUserListings();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  // Avatar upload handler
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);

    try {
      const optimizedDataUrl = await compressImage(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.85,
      });

      const storage = getStorage(app);
      const fileName = `${Date.now()}_avatar.jpg`;
      const storageRef = ref(storage, `avatars/${currentUser.uid}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (err) => {
          console.warn('Storage upload fallback:', err);
          setAvatarUrl(optimizedDataUrl);
          setUploadingAvatar(false);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setAvatarUrl(downloadUrl);
            await updateUser({ avatar: downloadUrl });
          } catch {
            setAvatarUrl(optimizedDataUrl);
          } finally {
            setUploadingAvatar(false);
          }
        }
      );
    } catch (err) {
      setProfileError('Failed to process avatar image: ' + err.message);
      setUploadingAvatar(false);
    }
  };

  // Profile save handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      await updateUser({
        displayName: displayName.trim(),
        phone: phone.trim(),
        avatar: avatarUrl,
      });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Resend email verification
  const handleResendVerification = async () => {
    setSendingVerification(true);
    setVerificationNotice(null);
    try {
      await resendVerification();
      setVerificationNotice('Verification email sent! Check your inbox and spam folder.');
    } catch (err) {
      setVerificationNotice(err.message || 'Failed to send verification email. Try again later.');
    } finally {
      setSendingVerification(false);
    }
  };

  // Delete listing handler
  const handleDeleteListing = async (listingId) => {
    setDeleting(true);
    try {
      await deleteListing(listingId);
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Failed to delete listing: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await logOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const pendingCount = listings.filter((l) => l.status === 'pending').length;
  const approvedCount = listings.filter((l) => l.status === 'approved').length;
  const rejectedCount = listings.filter((l) => l.status === 'rejected').length;

  return (
    <div className='max-w-6xl mx-auto px-4 py-8 space-y-8 text-slate-800'>
      {/* Header Profile Summary Card */}
      <div className='bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6'>
        <div className='flex items-center gap-5'>
          <div className='relative group'>
            <img
              src={
                avatarUrl ||
                'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
              }
              alt='Profile Avatar'
              className='w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-slate-200 shadow-inner'
            />
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              title='Change Avatar'
              className='absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition shadow-md cursor-pointer'
            >
              <FaCamera className='text-xs' />
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              onChange={handleAvatarChange}
              className='hidden'
            />
          </div>

          <div className='space-y-1.5'>
            <div className='flex items-center gap-2 flex-wrap'>
              <h1 className='text-xl sm:text-2xl font-black text-slate-900'>
                {displayName || currentUser?.displayName || currentUser?.email?.split('@')[0]}
              </h1>
              {isAdmin && (
                <span className='px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-amber-300'>
                  Admin
                </span>
              )}
            </div>

            <p className='text-xs text-slate-500 flex items-center gap-1.5'>
              <FaEnvelope className='text-slate-400' />
              <span>{currentUser?.email}</span>
            </p>

            {/* Email verification status badge */}
            <div className='pt-1'>
              {isEmailVerified ? (
                <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800'>
                  <FaCheckCircle className='text-emerald-600 text-xs' />
                  <span>Verified Host / Driver</span>
                </span>
              ) : (
                <div className='inline-flex items-center gap-2 flex-wrap'>
                  <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800'>
                    <FaExclamationTriangle className='text-amber-600 text-xs' />
                    <span>Email Unverified</span>
                  </span>
                  <button
                    type='button'
                    onClick={handleResendVerification}
                    disabled={sendingVerification}
                    className='text-xs font-bold text-amber-700 hover:text-amber-800 underline cursor-pointer'
                  >
                    {sendingVerification ? 'Sending...' : 'Send Verification Link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex items-center gap-2.5 flex-wrap'>
          <Link
            to='/create-listing'
            className='inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer'
          >
            <FaPlus />
            <span>Post a Listing</span>
          </Link>

          {isAdmin && (
            <Link
              to='/admin-dashboard'
              className='inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold rounded-xl text-xs sm:text-sm transition shadow-sm'
            >
              <FaShieldAlt />
              <span>Admin Panel</span>
            </Link>
          )}

          <button
            type='button'
            onClick={handleSignOut}
            className='inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition cursor-pointer'
          >
            <FaSignOutAlt />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {verificationNotice && (
        <div className='p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs font-medium'>
          {verificationNotice}
        </div>
      )}

      {/* Tabs Row */}
      <div className='flex items-center gap-2 border-b border-slate-200 pb-2'>
        <button
          type='button'
          onClick={() => setActiveTab('listings')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'listings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          My Listings ({listings.length})
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Profile Settings
        </button>
      </div>

      {/* SECTION 1: MY LISTINGS */}
      {activeTab === 'listings' && (
        <div className='space-y-6'>
          {/* Status Metrics Bar */}
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
            <div className='p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs'>
              <p className='text-xs font-semibold text-slate-500'>Total Listings</p>
              <p className='text-2xl font-black text-slate-900 mt-1'>{listings.length}</p>
            </div>
            <div className='p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs'>
              <p className='text-xs font-semibold text-amber-700'>Pending Approval</p>
              <p className='text-2xl font-black text-amber-900 mt-1'>{pendingCount}</p>
            </div>
            <div className='p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs'>
              <p className='text-xs font-semibold text-emerald-700'>Approved &amp; Live</p>
              <p className='text-2xl font-black text-emerald-900 mt-1'>{approvedCount}</p>
            </div>
            <div className='p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-2xs'>
              <p className='text-xs font-semibold text-rose-700'>Needs Revision</p>
              <p className='text-2xl font-black text-rose-900 mt-1'>{rejectedCount}</p>
            </div>
          </div>

          {loadingListings ? (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {[1, 2].map((n) => (
                <div key={n} className='h-48 bg-slate-100 rounded-2xl animate-pulse' />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className='p-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl space-y-4'>
              <div className='w-14 h-14 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto text-2xl'>
                <FaHome />
              </div>
              <h3 className='text-lg font-bold text-slate-900'>No listings posted yet</h3>
              <p className='text-xs text-slate-500 max-w-md mx-auto leading-relaxed'>
                Start by publishing your boutique guest house or private vehicle leasing offer to reach travelers.
              </p>
              <Link
                to='/create-listing'
                className='inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-sm'
              >
                <FaPlus />
                <span>Post Your First Listing</span>
              </Link>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              {listings.map((item) => {
                const isGuestHouse = item.type === 'guesthouse';
                const coverImage =
                  Array.isArray(item.images) && item.images.length > 0
                    ? item.images[0]
                    : Array.isArray(item.imageUrls) && item.imageUrls.length > 0
                    ? item.imageUrls[0]
                    : isGuestHouse
                    ? '/images/airbnb_apartment_living.jpg'
                    : '/images/city_regular_sedan.jpg';

                return (
                  <div
                    key={item.id}
                    className='bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition flex flex-col justify-between'
                  >
                    <div>
                      {/* Top Media Bar */}
                      <div className='relative h-44 bg-slate-900 overflow-hidden'>
                        <img
                          src={coverImage}
                          alt={item.title}
                          className='w-full h-full object-cover'
                        />
                        <div className='absolute top-3 left-3 flex items-center gap-2'>
                          <span className='px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900/90 text-white backdrop-blur-xs'>
                            {isGuestHouse ? 'Guest House' : 'Car Leasing'}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className='absolute top-3 right-3'>
                          {item.status === 'approved' && (
                            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500 text-white shadow-sm'>
                              <FaCheckCircle className='text-xs' />
                              <span>Live on Marketplace</span>
                            </span>
                          )}
                          {item.status === 'pending' && (
                            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-950 shadow-sm'>
                              <FaClock className='text-xs' />
                              <span>Pending Admin Approval</span>
                            </span>
                          )}
                          {item.status === 'rejected' && (
                            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white shadow-sm'>
                              <FaExclamationTriangle className='text-xs' />
                              <span>Requires Revision</span>
                            </span>
                          )}
                          {item.status === 'archived' && (
                            <span className='px-3 py-1 rounded-full text-xs font-bold bg-slate-600 text-white'>
                              Archived
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className='p-5 space-y-2.5'>
                        <h4 className='font-bold text-slate-900 text-base line-clamp-1'>
                          {item.title}
                        </h4>

                        <p className='text-xs text-slate-500 line-clamp-1'>
                          {item.city || item.location || 'Location upon request'}
                        </p>

                        <div className='flex items-baseline gap-1 text-slate-900 font-extrabold text-sm'>
                          <span>${item.price}</span>
                          <span className='text-xs text-slate-500 font-medium'>
                            / {item.priceUnit || (isGuestHouse ? 'night' : 'day')}
                          </span>
                        </div>

                        {/* If Rejected: Show reason */}
                        {item.status === 'rejected' && item.rejectionReason && (
                          <div className='p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed'>
                            <span className='font-bold block'>Moderator Feedback:</span>
                            {item.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Bottom Bar */}
                    <div className='px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2'>
                      <Link
                        to={`/listing/${item.id}`}
                        className='inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition py-1'
                      >
                        <FaEye className='text-xs' />
                        <span>Preview</span>
                      </Link>

                      <div className='flex items-center gap-2'>
                        <Link
                          to={`/update-listing/${item.id}`}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition shadow-2xs'
                        >
                          <FaEdit className='text-xs' />
                          <span>Edit</span>
                        </Link>

                        <button
                          type='button'
                          onClick={() => setDeleteConfirmId(item.id)}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold transition shadow-2xs cursor-pointer'
                        >
                          <FaTrashAlt className='text-xs' />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PROFILE SETTINGS */}
      {activeTab === 'settings' && (
        <div className='max-w-2xl bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6'>
          <div>
            <h3 className='text-lg font-bold text-slate-900'>Host &amp; Driver Profile Settings</h3>
            <p className='text-xs text-slate-500 mt-1'>
              Update your contact information. This is used by guests to reach you when booking.
            </p>
          </div>

          {profileSuccess && (
            <div className='p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold'>
              {profileSuccess}
            </div>
          )}

          {profileError && (
            <div className='p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold'>
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className='space-y-4'>
            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1'>Display Name / Business Name</label>
              <div className='relative'>
                <FaUser className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
                <input
                  type='text'
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder='e.g. Muyenga Villa Host or Munyonyo Chauffeur Services'
                  className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1'>Registered Email</label>
              <div className='relative'>
                <FaEnvelope className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
                <input
                  type='email'
                  disabled
                  value={currentUser?.email || ''}
                  className='w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed'
                />
              </div>
              <p className='text-[11px] text-slate-400 mt-1'>Email cannot be changed directly.</p>
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1'>
                Contact Phone / WhatsApp
              </label>
              <div className='relative'>
                <FaPhone className='absolute left-3.5 top-3.5 text-slate-400 text-xs' />
                <input
                  type='tel'
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='+291 1 123456 or +1 555 123 4567'
                  className='w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900'
                />
              </div>
              <p className='text-[11px] text-slate-400 mt-1'>
                Used on your listings for the direct WhatsApp &amp; Call buttons.
              </p>
            </div>

            <button
              type='submit'
              disabled={savingProfile}
              className='px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-sm disabled:opacity-50 cursor-pointer'
            >
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn'>
          <div className='bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl'>
            <div className='w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mx-auto'>
              <FaTrashAlt />
            </div>
            <div className='text-center space-y-1'>
              <h3 className='font-bold text-slate-900 text-base'>Delete Listing?</h3>
              <p className='text-xs text-slate-500'>
                This will permanently remove the listing and its photos from Firestore. This action cannot be undone.
              </p>
            </div>
            <div className='flex items-center gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setDeleteConfirmId(null)}
                className='flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer'
              >
                Cancel
              </button>
              <button
                type='button'
                disabled={deleting}
                onClick={() => handleDeleteListing(deleteConfirmId)}
                className='flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50'
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
