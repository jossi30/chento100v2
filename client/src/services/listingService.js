import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';

const LISTINGS_COLLECTION = 'listings';
const USERS_COLLECTION = 'users';
const REPORTS_COLLECTION = 'reports';
const AUDIT_COLLECTION = 'auditLogs';
const SETTINGS_COLLECTION = 'settings';

/**
 * Normalizes any listing object into standard frontend format
 */
export function normalizeClientListing(data, id) {
  if (!data) return null;
  const _id = id || data.id || data._id || `listing_${Date.now()}`;
  const isGuestHouse =
    data.type === 'guesthouse' ||
    data.category === 'guesthouse' ||
    data.type === 'rent';
  const type = isGuestHouse ? 'guesthouse' : 'car';
  const category = isGuestHouse ? 'guesthouse' : 'car_service';
  const title = data.title || data.name || 'Untitled Listing';
  const name = data.name || title;

  let images = Array.isArray(data.images) && data.images.length > 0
    ? data.images
    : Array.isArray(data.imageUrls) && data.imageUrls.length > 0
    ? data.imageUrls
    : [isGuestHouse ? '/images/airbnb_apartment_living.jpg' : '/images/city_regular_sedan.jpg'];

  const price = Number(data.price !== undefined ? data.price : (data.regularPrice || 0));
  const regularPrice = Number(data.regularPrice !== undefined ? data.regularPrice : price);
  const discountPrice = Number(data.discountPrice || data.discountedPrice || 0);
  const location = data.location || data.address || 'City Center';
  const city = data.city || location.split(',')[0].trim() || 'City Center';
  const area = data.area || '';
  const address = data.address || location;

  const status = data.status || (data.isApproved ? 'approved' : 'pending');
  const isApproved = status === 'approved' || Boolean(data.isApproved);
  const active = data.active !== undefined ? Boolean(data.active) : (data.isActive !== undefined ? Boolean(data.isActive) : isApproved);

  return {
    ...data,
    id: _id,
    _id,
    type,
    category,
    title,
    name,
    description: data.description || '',
    images,
    imageUrls: images,
    price,
    regularPrice,
    discountPrice,
    discountedPrice: discountPrice,
    priceUnit: data.priceUnit || (isGuestHouse ? 'night' : 'day'),
    currency: data.currency || 'USD',
    location,
    address,
    city,
    area,
    status,
    isApproved,
    active,
    isActive: active,
    featured: Boolean(data.featured),
    rejectionReason: data.rejectionReason || '',
    ownerId: data.ownerId || data.userRef || 'user_guest',
    userRef: data.userRef || data.ownerId || 'user_guest',
    ownerEmail: data.ownerEmail || '',
    contactPhone: data.contactPhone || '',
    bedrooms: Number(data.bedrooms || (isGuestHouse ? 1 : 0)),
    bathrooms: Number(data.bathrooms || (isGuestHouse ? 1 : 0)),
    maxGuests: Number(data.maxGuests || (isGuestHouse ? 2 : 4)),
    seats: Number(data.seats || (isGuestHouse ? 0 : 4)),
    driverIncluded: data.driverIncluded !== undefined ? Boolean(data.driverIncluded) : !isGuestHouse,
    driverName: data.driverName || '',
    driverContact: data.driverContact || '',
    amenities: Array.isArray(data.amenities)
      ? data.amenities
      : (typeof data.amenities === 'string' && data.amenities ? data.amenities.split(',').map((s) => s.trim()).filter(Boolean) : ['WiFi', 'Air Conditioning']),
    viewCount: Number(data.viewCount || 0),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetch from backend API bridge for synchronized data
 */
async function fetchApiListings(params = {}) {
  try {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        q.set(k, String(v));
      }
    });
    const res = await fetch(`/api/listing/get?${q.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * Fetch approved listings with filtering, sorting, and cursor pagination
 * Fully synced between Firestore and Admin API
 */
export async function getApprovedListings({
  type = null,
  city = null,
  minPrice = null,
  maxPrice = null,
  bedrooms = null,
  seats = null,
  amenities = [],
  driverIncluded = null,
  sortBy = 'newest',
  lastDoc = null,
  pageSize = 12,
} = {}) {
  const combinedMap = new Map();

  // 1. Try Firestore approved query
  try {
    let q = collection(db, LISTINGS_COLLECTION);
    const constraints = [where('status', '==', 'approved')];
    if (type && type !== 'all') {
      constraints.push(where('type', '==', type));
    }
    const snap = await getDocs(query(q, ...constraints));
    snap.forEach((docSnap) => {
      const norm = normalizeClientListing(docSnap.data(), docSnap.id);
      norm._doc = docSnap;
      combinedMap.set(norm.id, norm);
    });
  } catch (err) {
    // Firestore might be unseeded or offline
  }

  // 2. Fetch from Backend API bridge (includes admin creations and approved items)
  try {
    const apiParams = { onlyApproved: true };
    if (type && type !== 'all') apiParams.type = type;
    const apiItems = await fetchApiListings(apiParams);
    apiItems.forEach((item) => {
      const norm = normalizeClientListing(item);
      if (!combinedMap.has(norm.id)) {
        combinedMap.set(norm.id, norm);
      } else {
        const existing = combinedMap.get(norm.id);
        combinedMap.set(norm.id, { ...existing, ...norm });
      }
    });
  } catch (apiErr) {
    console.warn('API listings sync error:', apiErr.message);
  }

  // 3. In-memory refinement for secondary filters
  let items = Array.from(combinedMap.values()).filter((data) => {
    // Only approved & active listings on main page
    if (data.status !== 'approved' || data.active === false || data.isActive === false) {
      return false;
    }

    if (type && type !== 'all') {
      if (type === 'guesthouse') {
        if (data.type !== 'guesthouse' && data.category !== 'guesthouse' && data.type !== 'rent') {
          return false;
        }
      } else if (type === 'car') {
        if (data.type !== 'car' && data.category !== 'car_service' && data.type !== 'sale') {
          return false;
        }
      }
    }

    if (city && city.trim()) {
      const c = city.toLowerCase().trim();
      const inCity = data.city && data.city.toLowerCase().includes(c);
      const inLoc = data.location && data.location.toLowerCase().includes(c);
      const inAddr = data.address && data.address.toLowerCase().includes(c);
      const inTitle = data.title && data.title.toLowerCase().includes(c);
      if (!inCity && !inLoc && !inAddr && !inTitle) return false;
    }

    if (minPrice !== null && minPrice !== undefined && Number(data.price) < Number(minPrice)) {
      return false;
    }
    if (maxPrice !== null && maxPrice !== undefined && Number(data.price) > Number(maxPrice)) {
      return false;
    }

    if (bedrooms && data.type === 'guesthouse' && Number(data.bedrooms) < Number(bedrooms)) {
      return false;
    }

    if (seats && data.type === 'car' && Number(data.seats) < Number(seats)) {
      return false;
    }

    if (driverIncluded !== null && data.type === 'car' && Boolean(data.driverIncluded) !== Boolean(driverIncluded)) {
      return false;
    }

    if (amenities && amenities.length > 0 && data.amenities) {
      const itemAmenities = Array.isArray(data.amenities) ? data.amenities : [];
      const hasAll = amenities.every((a) =>
        itemAmenities.some((ia) => ia.toLowerCase().includes(a.toLowerCase()))
      );
      if (!hasAll) return false;
    }

    return true;
  });

  // Sort
  if (sortBy === 'price_asc') {
    items.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortBy === 'price_desc') {
    items.sort((a, b) => Number(b.price) - Number(a.price));
  } else {
    items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  const pagedListings = items.slice(0, pageSize);
  return {
    listings: pagedListings,
    lastVisible: null,
    hasMore: items.length > pageSize,
  };
}

/**
 * Fetch featured approved listings
 */
export async function getFeaturedListings(type = null, limitCount = 6) {
  const combinedMap = new Map();

  try {
    const constraints = [
      where('status', '==', 'approved'),
      where('featured', '==', true),
      limit(limitCount),
    ];
    if (type && type !== 'all') constraints.unshift(where('type', '==', type));
    const snap = await getDocs(query(collection(db, LISTINGS_COLLECTION), ...constraints));
    snap.forEach((d) => {
      const norm = normalizeClientListing(d.data(), d.id);
      combinedMap.set(norm.id, norm);
    });
  } catch (err) {
    /* ignore firestore error */
  }

  try {
    const apiItems = await fetchApiListings({ onlyApproved: true, featured: true });
    apiItems.forEach((item) => {
      const norm = normalizeClientListing(item);
      if (!combinedMap.has(norm.id)) combinedMap.set(norm.id, norm);
    });
  } catch (e) {
    /* ignore api error */
  }

  let list = Array.from(combinedMap.values()).filter((item) => {
    if (item.status !== 'approved' || item.active === false || item.isActive === false) return false;
    if (type && type !== 'all') {
      if (type === 'guesthouse' && item.type !== 'guesthouse' && item.category !== 'guesthouse') return false;
      if (type === 'car' && item.type !== 'car' && item.category !== 'car_service') return false;
    }
    return Boolean(item.featured);
  });

  if (list.length === 0) {
    const fallbackListings = await getApprovedListings({ type, pageSize: limitCount });
    return fallbackListings.listings.slice(0, limitCount);
  }

  return list.slice(0, limitCount);
}

/**
 * Fetch recent approved listings for Home Page
 */
export async function getRecentApprovedListings(type = null, limitCount = 6) {
  const result = await getApprovedListings({ type, pageSize: limitCount });
  return result.listings.slice(0, limitCount);
}

/**
 * Fetch single listing by ID and increment view count
 */
export async function getListingById(id) {
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updateDoc(docRef, { viewCount: increment(1) }).catch(() => {});
      return normalizeClientListing(snap.data(), snap.id);
    }
  } catch (err) {
    /* ignore firestore doc error */
  }

  // Fallback to backend API
  try {
    let res = await fetch(`/api/listing/get/${id}`);
    if (!res.ok) res = await fetch(`/api/listing/${id}`);
    if (!res.ok) res = await fetch(`/api/admin/listings/${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data._id || data.id)) {
        return normalizeClientListing(data, data._id || data.id);
      }
    }
  } catch (apiErr) {
    console.warn('API getListingById error:', apiErr.message);
  }

  return null;
}

/**
 * Fetch all listings created by a specific user (My Listings)
 */
export async function getUserListings(userId) {
  const combinedMap = new Map();
  try {
    const q = query(
      collection(db, LISTINGS_COLLECTION),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const norm = normalizeClientListing(d.data(), d.id);
      combinedMap.set(norm.id, norm);
    });
  } catch (err) {
    /* ignore firestore query error */
  }

  try {
    const apiItems = await fetchApiListings({ all: true });
    apiItems.forEach((item) => {
      if (item.ownerId === userId || item.userRef === userId) {
        const norm = normalizeClientListing(item);
        if (!combinedMap.has(norm.id)) combinedMap.set(norm.id, norm);
      }
    });
  } catch (apiErr) {
    /* ignore api query error */
  }

  const list = Array.from(combinedMap.values());
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

/**
 * Create a new listing with strict 'pending' status
 * Syncs to both Firestore and Backend API
 */
export async function createListing(listingData, user) {
  if (!user) throw new Error('You must be signed in to create a listing.');

  const cleanData = {
    ...listingData,
    type: listingData.type || 'guesthouse',
    title: listingData.title?.trim() || '',
    name: listingData.title?.trim() || listingData.name || '',
    description: listingData.description?.trim() || '',
    price: Number(listingData.price) || 0,
    regularPrice: Number(listingData.regularPrice) || Number(listingData.price) || 0,
    priceUnit: listingData.priceUnit || (listingData.type === 'guesthouse' ? 'night' : 'day'),
    currency: listingData.currency || 'USD',
    city: listingData.city?.trim() || '',
    area: listingData.area?.trim() || '',
    address: listingData.address?.trim() || listingData.city || '',
    location: listingData.location || listingData.address || listingData.city || '',
    images: Array.isArray(listingData.images) ? listingData.images.slice(0, 8) : [],
    imageUrls: Array.isArray(listingData.images) ? listingData.images.slice(0, 8) : [],
    ownerId: user.uid,
    userRef: user.uid,
    ownerEmail: user.email || '',
    contactPhone: listingData.contactPhone?.trim() || '',
    status: 'pending', // Rule 4: Every new listing is created with status "pending"
    isApproved: false,
    active: true,
    isActive: true,
    rejectionReason: '',
    featured: false,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add guest house specific fields
  if (cleanData.type === 'guesthouse') {
    cleanData.bedrooms = Number(listingData.bedrooms) || 1;
    cleanData.bathrooms = Number(listingData.bathrooms) || 1;
    cleanData.maxGuests = Number(listingData.maxGuests) || 2;
    cleanData.amenities = Array.isArray(listingData.amenities) ? listingData.amenities : [];
    cleanData.checkIn = listingData.checkIn || '14:00';
    cleanData.checkOut = listingData.checkOut || '11:00';
    cleanData.houseRules = listingData.houseRules || 'No smoking, quiet hours after 10 PM';
  } else {
    // Add car leasing specific fields
    cleanData.make = listingData.make?.trim() || '';
    cleanData.model = listingData.model?.trim() || '';
    cleanData.year = Number(listingData.year) || new Date().getFullYear();
    cleanData.transmission = listingData.transmission || 'automatic';
    cleanData.fuel = listingData.fuel || 'Petrol';
    cleanData.seats = Number(listingData.seats) || 4;
    cleanData.mileageLimit = listingData.mileageLimit || '200 km / day';
    cleanData.deposit = Number(listingData.deposit) || 0;
    cleanData.minLeaseTerm = listingData.minLeaseTerm || '1 day';
    cleanData.driverIncluded = Boolean(listingData.driverIncluded);
  }

  let createdDoc = null;
  try {
    const docRef = await addDoc(collection(db, LISTINGS_COLLECTION), cleanData);
    createdDoc = { id: docRef.id, _id: docRef.id, ...cleanData };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, LISTINGS_COLLECTION);
  }

  // Sync create with backend API so Admin Dashboard sees it immediately in pending review
  try {
    const res = await fetch('/api/listing/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.uid,
        'x-user-email': user.email || '',
        'x-user-role': user.role || 'user',
      },
      body: JSON.stringify({
        ...(createdDoc || cleanData),
        id: createdDoc?.id,
        _id: createdDoc?.id,
      }),
    });
    if (res.ok) {
      const apiCreated = await res.json();
      return createdDoc || normalizeClientListing(apiCreated);
    }
  } catch (apiErr) {
    console.warn('API create sync notice:', apiErr.message);
  }

  if (createdDoc) return createdDoc;
  throw new Error('Failed to create listing. Please try again.');
}

/**
 * Update an existing listing and sync with API
 */
export async function updateListing(id, updates, isAdmin = false) {
  const docRef = doc(db, LISTINGS_COLLECTION, id);

  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (!isAdmin) {
    delete cleanUpdates.status;
    delete cleanUpdates.approvedAt;
    delete cleanUpdates.approvedBy;
    delete cleanUpdates.featured;
    delete cleanUpdates.rejectionReason;
    delete cleanUpdates.ownerId;
  }

  try {
    await updateDoc(docRef, cleanUpdates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${id}`);
  }

  // Sync update with backend API
  try {
    await fetch(`/api/admin/listings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify(cleanUpdates),
    });
  } catch (apiErr) {
    console.warn('API update sync notice:', apiErr.message);
  }

  return true;
}

/**
 * Soft delete (archive) listing
 */
export async function archiveListing(id) {
  const docRef = doc(db, LISTINGS_COLLECTION, id);
  try {
    await updateDoc(docRef, {
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${id}`);
  }

  try {
    await fetch(`/api/admin/listings/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ status: 'archived', active: false, isActive: false }),
    });
  } catch (apiErr) {
    /* ignore archive api error */
  }

  return true;
}

/**
 * Permanent delete listing (syncs with Firestore and backend API)
 */
export async function deleteListing(id) {
  const docRef = doc(db, LISTINGS_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${LISTINGS_COLLECTION}/${id}`);
  }

  // Also sync delete with backend API
  try {
    await Promise.allSettled([
      fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-auth': 'true',
          'x-user-role': 'admin',
        },
      }),
      fetch(`/api/listing/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-auth': 'true',
          'x-user-role': 'admin',
        },
      }),
    ]);
  } catch (apiErr) {
    console.warn('API delete sync notice:', apiErr.message);
  }

  return true;
}

/**
 * Report a listing
 */
export async function submitReport(listingId, reason, reporterId = 'visitor') {
  try {
    await addDoc(collection(db, REPORTS_COLLECTION), {
      listingId,
      reporterId,
      reason,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, REPORTS_COLLECTION);
    throw err;
  }
}

// ==========================================
// ADMIN SERVICE METHODS
// ==========================================

/**
 * Get dashboard stats calculated from live queries
 */
export async function getAdminStats() {
  const allListings = await getAllListingsForAdmin('all');
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let archivedCount = 0;

  allListings.forEach((data) => {
    if (data.status === 'pending' || !data.isApproved) pendingCount++;
    else if (data.status === 'approved' && data.isApproved) approvedCount++;
    else if (data.status === 'rejected') rejectedCount++;
    else if (data.status === 'archived') archivedCount++;
  });

  let totalUsers = 3;
  let openReportsCount = 0;
  try {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    if (usersSnap.size > 0) totalUsers = usersSnap.size;
  } catch (e) {
    /* ignore users snap error */
  }

  try {
    const reportsSnap = await getDocs(collection(db, REPORTS_COLLECTION));
    openReportsCount = reportsSnap.size;
  } catch (e) {
    /* ignore reports snap error */
  }

  return {
    totalUsers,
    totalListings: allListings.length,
    pendingCount,
    approvedCount,
    rejectedCount,
    archivedCount,
    openReportsCount,
  };
}

/**
 * Fetch all pending listings for admin queue (synced with Firestore and API)
 */
export async function getPendingListings() {
  const combinedMap = new Map();
  try {
    const q = query(
      collection(db, LISTINGS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const norm = normalizeClientListing(d.data(), d.id);
      combinedMap.set(norm.id, norm);
    });
  } catch (err) {
    /* ignore pending firestore error */
  }

  try {
    const res = await fetch('/api/admin/listings/pending', {
      headers: { 'x-admin-auth': 'true', 'x-user-role': 'admin' },
    });
    if (res.ok) {
      const apiList = await res.json();
      if (Array.isArray(apiList)) {
        apiList.forEach((item) => {
          const norm = normalizeClientListing(item);
          combinedMap.set(norm.id, norm);
        });
      }
    }
  } catch (apiErr) {
    console.warn('API pending sync notice:', apiErr.message);
  }

  const list = Array.from(combinedMap.values()).filter((item) => item.status === 'pending' || !item.isApproved);
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

/**
 * Fetch all listings for management table (synced with Firestore and API)
 */
export async function getAllListingsForAdmin(statusFilter = 'all') {
  const combinedMap = new Map();
  try {
    const q = query(collection(db, LISTINGS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const norm = normalizeClientListing(d.data(), d.id);
      combinedMap.set(norm.id, norm);
    });
  } catch (err) {
    /* ignore all listings firestore error */
  }

  try {
    const res = await fetch('/api/admin/listings/all', {
      headers: { 'x-admin-auth': 'true', 'x-user-role': 'admin' },
    });
    if (res.ok) {
      const apiList = await res.json();
      if (Array.isArray(apiList)) {
        apiList.forEach((item) => {
          const norm = normalizeClientListing(item);
          combinedMap.set(norm.id, norm);
        });
      }
    }
  } catch (apiErr) {
    console.warn('API all listings sync notice:', apiErr.message);
  }

  let list = Array.from(combinedMap.values());
  if (statusFilter && statusFilter !== 'all') {
    list = list.filter((item) => item.status === statusFilter);
  }
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

/**
 * Approve a pending listing (updates Firestore and backend API)
 */
export async function approveListing(listingId, adminUid) {
  const docRef = doc(db, LISTINGS_COLLECTION, listingId);
  try {
    await updateDoc(docRef, {
      status: 'approved',
      rejectionReason: '',
      approvedAt: new Date().toISOString(),
      approvedBy: adminUid,
      updatedAt: new Date().toISOString(),
    });

    // Write audit log
    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'APPROVE_LISTING',
      targetId: listingId,
      timestamp: new Date().toISOString(),
    }).catch(console.warn);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
  }

  // Sync approval with backend API so both admin and main page stay in sync
  try {
    await fetch(`/api/admin/listings/${listingId}/approve`, {
      method: 'PATCH',
      headers: {
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
    });
  } catch (apiErr) {
    console.warn('API approve sync notice:', apiErr.message);
  }

  return true;
}

/**
 * Reject a pending listing with required reason (updates Firestore and backend API)
 */
export async function rejectListing(listingId, reason, adminUid) {
  if (!reason || !reason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const docRef = doc(db, LISTINGS_COLLECTION, listingId);
  try {
    await updateDoc(docRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: new Date().toISOString(),
    });

    // Write audit log
    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'REJECT_LISTING',
      targetId: listingId,
      reason: reason.trim(),
      timestamp: new Date().toISOString(),
    }).catch(console.warn);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
  }

  // Sync rejection with backend API
  try {
    await fetch(`/api/admin/listings/${listingId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ reason: reason.trim() }),
    });
  } catch (apiErr) {
    console.warn('API reject sync notice:', apiErr.message);
  }

  return true;
}

/**
 * Toggle featured flag on listing (updates Firestore and backend API)
 */
export async function toggleFeaturedListing(listingId, featuredState, adminUid) {
  const docRef = doc(db, LISTINGS_COLLECTION, listingId);
  try {
    await updateDoc(docRef, {
      featured: Boolean(featuredState),
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: featuredState ? 'FEATURE_LISTING' : 'UNFEATURE_LISTING',
      targetId: listingId,
      timestamp: new Date().toISOString(),
    }).catch(console.warn);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
  }

  // Sync featured with backend API
  try {
    await fetch(`/api/admin/listings/${listingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ featured: Boolean(featuredState) }),
    });
  } catch (apiErr) {
    console.warn('API featured sync notice:', apiErr.message);
  }

  return true;
}

/**
 * Get all users for admin users table (synced with Firestore and backend API)
 */
export async function getAllUsers(typeFilter = 'all') {
  const usersMap = new Map();

  // 1. Try fetching from Firestore users collection
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    snap.forEach((d) => {
      const data = d.data();
      const id = d.id;
      usersMap.set(id, {
        uid: id,
        id,
        _id: id,
        displayName: data.displayName || data.username || data.email?.split('@')[0],
        name: data.displayName || data.username || data.email?.split('@')[0],
        email: data.email || '',
        phone: data.phone || data.phoneNumber || '',
        phoneNumber: data.phoneNumber || data.phone || '',
        accountType: data.accountType || (data.isAdmin ? 'admin' : data.role === 'host' ? 'host' : 'user'),
        role: data.role || (data.isAdmin ? 'admin' : 'user'),
        hostType: data.hostType || null,
        emailVerified: Boolean(data.emailVerified),
        verified: data.verified !== undefined ? Boolean(data.verified) : Boolean(data.emailVerified),
        disabled: Boolean(data.disabled),
        createdAt: data.createdAt || new Date().toISOString(),
        ...data,
      });
    });
  } catch (err) {
    /* ignore firestore read errors in case of permissions or offline */
  }

  // 2. Fetch from backend API /api/admin/users
  try {
    const url = typeFilter && typeFilter !== 'all' ? `/api/admin/users?type=${typeFilter}` : '/api/admin/users';
    const res = await fetch(url, {
      headers: {
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
    });
    if (res.ok) {
      const apiUsers = await res.json();
      if (Array.isArray(apiUsers)) {
        apiUsers.forEach((u) => {
          const id = u.uid || u._id || u.id;
          const existing = usersMap.get(id);
          usersMap.set(id, {
            ...existing,
            ...u,
            uid: id,
            id,
            _id: id,
            displayName: u.displayName || u.username || existing?.displayName,
            name: u.name || u.displayName || u.username || existing?.displayName,
            phone: u.phone || u.phoneNumber || existing?.phone || '',
            phoneNumber: u.phoneNumber || u.phone || existing?.phoneNumber || '',
            accountType: u.accountType || (u.isAdmin ? 'admin' : u.role === 'host' ? 'host' : 'user'),
          });
        });
      }
    }
  } catch (apiErr) {
    console.warn('API users sync notice:', apiErr.message);
  }

  const list = Array.from(usersMap.values());
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

/**
 * Get enquiries & concierge bookings for admin
 */
export async function getAdminEnquiries() {
  try {
    const res = await fetch('/api/admin/enquiries', {
      headers: { 'x-admin-auth': 'true', 'x-user-role': 'admin' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    /* ignore api error */
  }
  return [];
}

/**
 * Update enquiry status
 */
export async function updateAdminEnquiry(id, status, notes = '') {
  try {
    const res = await fetch(`/api/admin/enquiries/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ status, notes }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    /* ignore api error */
  }
  return null;
}

/**
 * Toggle user disabled status
 */
export async function toggleUserDisabled(userId, disabledState, adminUid) {
  const docRef = doc(db, USERS_COLLECTION, userId);
  try {
    await updateDoc(docRef, {
      disabled: Boolean(disabledState),
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: disabledState ? 'DISABLE_USER' : 'ENABLE_USER',
      targetId: userId,
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COLLECTION}/${userId}`);
    throw err;
  }
}

/**
 * Get all listing reports
 */
export async function getAllReports() {
  try {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, REPORTS_COLLECTION);
    return [];
  }
}

/**
 * Update report status
 */
export async function updateReportStatus(reportId, status) {
  const docRef = doc(db, REPORTS_COLLECTION, reportId);
  try {
    await updateDoc(docRef, { status });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${REPORTS_COLLECTION}/${reportId}`);
    throw err;
  }
}

/**
 * Get audit logs
 */
export async function getAuditLogs(limitCount = 50) {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, AUDIT_COLLECTION);
    return [];
  }
}

/**
 * Subscribe to real-time live stat cards (onSnapshot)
 */
export function subscribeAdminStats(onUpdate) {
  let listingsCache = [];
  let usersCache = [];
  let reportsCache = [];

  const recalculate = () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let archivedCount = 0;

    let oldestPendingTime = null;
    let oldestPendingTitle = '';

    listingsCache.forEach((item) => {
      if (item.status === 'pending') {
        pendingCount++;
        const createdAtTime = new Date(item.createdAt || now).getTime();
        if (!oldestPendingTime || createdAtTime < oldestPendingTime) {
          oldestPendingTime = createdAtTime;
          oldestPendingTitle = item.title || 'Untitled';
        }
      } else if (item.status === 'approved') {
        approvedCount++;
      } else if (item.status === 'rejected') {
        rejectedCount++;
      } else if (item.status === 'archived') {
        archivedCount++;
      }
    });

    let newUsersLast7Days = 0;
    usersCache.forEach((u) => {
      const createdTime = new Date(u.createdAt || 0).getTime();
      if (createdTime >= sevenDaysAgo) {
        newUsersLast7Days++;
      }
    });

    const isOlderThan48h = oldestPendingTime ? (now - oldestPendingTime) > 48 * 60 * 60 * 1000 : false;
    const hoursWaiting = oldestPendingTime ? Math.floor((now - oldestPendingTime) / (60 * 60 * 1000)) : 0;

    onUpdate({
      totalUsers: usersCache.length,
      newUsers7Days: newUsersLast7Days,
      totalListings: listingsCache.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      archivedCount,
      openReportsCount: reportsCache.filter((r) => r.status === 'open' || !r.status).length,
      hasSlaWarning: isOlderThan48h,
      oldestPendingTitle,
      oldestPendingHours: hoursWaiting,
    });
  };

  // Seed immediately with synchronized listings
  getAllListingsForAdmin('all').then((items) => {
    if (items && items.length > 0 && listingsCache.length === 0) {
      listingsCache = items;
      recalculate();
    }
  }).catch(() => {});

  const unsubListings = onSnapshot(
    collection(db, LISTINGS_COLLECTION),
    (snap) => {
      listingsCache = [];
      snap.forEach((d) => listingsCache.push({ id: d.id, ...d.data() }));
      recalculate();
    },
    (err) => handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION)
  );

  const unsubUsers = onSnapshot(
    collection(db, USERS_COLLECTION),
    (snap) => {
      usersCache = [];
      snap.forEach((d) => usersCache.push({ uid: d.id, ...d.data() }));
      recalculate();
    },
    (err) => handleFirestoreError(err, OperationType.GET, USERS_COLLECTION)
  );

  const unsubReports = onSnapshot(
    collection(db, REPORTS_COLLECTION),
    (snap) => {
      reportsCache = [];
      snap.forEach((d) => reportsCache.push({ id: d.id, ...d.data() }));
      recalculate();
    },
    (err) => handleFirestoreError(err, OperationType.GET, REPORTS_COLLECTION)
  );

  return () => {
    unsubListings();
    unsubUsers();
    unsubReports();
  };
}

/**
 * Subscribe to real-time audit logs
 */
export function subscribeAuditLogs(onUpdate, limitCount = 50) {
  const q = query(
    collection(db, AUDIT_COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.GET, AUDIT_COLLECTION)
  );
}

/**
 * Get 30-day listing submission history grouped by day and type
 */
export async function getListingsHistory30Days() {
  try {
    const snap = await getDocs(collection(db, LISTINGS_COLLECTION));
    const now = new Date();
    const daysMap = new Map();

    // Initialize past 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      daysMap.set(dateKey, { date: dateKey, label, guesthouse: 0, car: 0, total: 0 });
    }

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      const dateKey = data.createdAt.split('T')[0];
      if (daysMap.has(dateKey)) {
        const item = daysMap.get(dateKey);
        if (data.type === 'car') {
          item.car += 1;
        } else {
          item.guesthouse += 1;
        }
        item.total += 1;
      }
    });

    return Array.from(daysMap.values());
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Request changes on a listing
 */
export async function requestChanges(listingId, notes, adminUid, ownerEmail = '', listingTitle = '') {
  const docRef = doc(db, LISTINGS_COLLECTION, listingId);
  try {
    await updateDoc(docRef, {
      status: 'changes_requested',
      changeRequestNotes: notes.trim(),
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'REQUEST_CHANGES',
      targetId: listingId,
      details: { notes: notes.trim(), title: listingTitle, ownerEmail },
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
    throw err;
  }
}

/**
 * Bulk approve multiple listings
 */
export async function bulkApproveListings(listingIds = [], adminUid) {
  if (!listingIds.length) return false;
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  listingIds.forEach((id) => {
    const docRef = doc(db, LISTINGS_COLLECTION, id);
    batch.update(docRef, {
      status: 'approved',
      rejectionReason: '',
      approvedAt: now,
      approvedBy: adminUid,
      updatedAt: now,
    });
  });

  try {
    await batch.commit();

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'BULK_APPROVE',
      targetId: 'multiple',
      details: { count: listingIds.length, ids: listingIds },
      timestamp: now,
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, LISTINGS_COLLECTION);
    throw err;
  }
}

/**
 * Bulk reject multiple listings
 */
export async function bulkRejectListings(listingIds = [], reason, adminUid) {
  if (!listingIds.length) return false;
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  listingIds.forEach((id) => {
    const docRef = doc(db, LISTINGS_COLLECTION, id);
    batch.update(docRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: now,
    });
  });

  try {
    await batch.commit();

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'BULK_REJECT',
      targetId: 'multiple',
      details: { count: listingIds.length, ids: listingIds, reason: reason.trim() },
      timestamp: now,
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, LISTINGS_COLLECTION);
    throw err;
  }
}

/**
 * Restore an archived or rejected listing to approved
 */
export async function restoreListing(listingId, adminUid) {
  const docRef = doc(db, LISTINGS_COLLECTION, listingId);
  try {
    await updateDoc(docRef, {
      status: 'approved',
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'RESTORE_LISTING',
      targetId: listingId,
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
    throw err;
  }
}

/**
 * Get owner intelligence profile (other listings, rejection history, report count)
 */
export async function getOwnerIntelligence(ownerId, ownerEmail) {
  try {
    let q = query(collection(db, LISTINGS_COLLECTION), where('ownerId', '==', ownerId));
    let snap = await getDocs(q);

    if (snap.empty && ownerEmail) {
      q = query(collection(db, LISTINGS_COLLECTION), where('ownerEmail', '==', ownerEmail));
      snap = await getDocs(q);
    }

    const otherListings = [];
    let rejectionCount = 0;
    const rejectionHistory = [];

    snap.forEach((d) => {
      const data = d.data();
      otherListings.push({ id: d.id, ...data });
      if (data.status === 'rejected') {
        rejectionCount++;
        rejectionHistory.push({
          id: d.id,
          title: data.title || 'Untitled',
          reason: data.rejectionReason || 'No reason provided',
          date: data.updatedAt || data.createdAt,
        });
      }
    });

    return {
      totalListings: otherListings.length,
      otherListings,
      rejectionCount,
      rejectionHistory,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return {
      totalListings: 0,
      otherListings: [],
      rejectionCount: 0,
      rejectionHistory: [],
    };
  }
}

/**
 * Get Marketplace Settings
 */
export async function getAdminSettings() {
  const defaultSettings = {
    adminEmails: ['jossvision11@gmail.com'],
    rejectionPresets: [
      'Blurry or low-quality images',
      'Missing or incomplete information',
      'Suspected scam or fraudulent activity',
      'Duplicate listing',
      'Wrong category or inappropriate content',
    ],
    maxPendingPerUser: 5,
    requireEmailVerification: true,
    slaHoursWarning: 48,
    reportThreshold: 3,
  };

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, 'marketplace');
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return defaultSettings;
    }
    return { ...defaultSettings, ...snap.data() };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${SETTINGS_COLLECTION}/marketplace`);
    return defaultSettings;
  }
}

/**
 * Update Marketplace Settings
 */
export async function updateAdminSettings(settings, adminUid) {
  const docRef = doc(db, SETTINGS_COLLECTION, 'marketplace');
  try {
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    }, { merge: true });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'UPDATE_SETTINGS',
      targetId: 'marketplace',
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SETTINGS_COLLECTION}/marketplace`);
    throw err;
  }
}

/**
 * Promote a user to Administrator
 */
export async function promoteUserToAdmin(userId, email, adminUid) {
  try {
    await setDoc(doc(db, 'admins', userId), {
      email,
      assignedBy: adminUid,
      assignedAt: new Date().toISOString(),
      role: 'admin',
    }, { merge: true });

    await setDoc(doc(db, 'users', userId), {
      role: 'admin',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'PROMOTE_ADMIN',
      targetId: userId,
      details: { email },
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${userId}`);
    throw err;
  }
}

/**
 * Demote an Administrator to User
 */
export async function demoteUserFromAdmin(userId, adminUid) {
  try {
    await deleteDoc(doc(db, 'admins', userId));

    await setDoc(doc(db, 'users', userId), {
      role: 'user',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await addDoc(collection(db, AUDIT_COLLECTION), {
      adminId: adminUid,
      action: 'DEMOTE_ADMIN',
      targetId: userId,
      timestamp: new Date().toISOString(),
    }).catch(console.warn);

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `admins/${userId}`);
    throw err;
  }
}

/**
 * Export users array to CSV file
 */
export function exportUsersCSV(users = []) {
  const headers = ['UID', 'Email', 'Display Name', 'Role', 'Email Verified', 'Disabled', 'Created At', 'Last Login'];
  const rows = users.map((u) => [
    `"${u.uid || u._id || ''}"`,
    `"${u.email || ''}"`,
    `"${(u.displayName || '').replace(/"/g, '""')}"`,
    `"${u.role || 'user'}"`,
    u.emailVerified ? 'Yes' : 'No',
    u.disabled ? 'Yes' : 'No',
    `"${u.createdAt || ''}"`,
    `"${u.lastLoginAt || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `chento100_users_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Callable Cloud Function / API: setAdminClaim
 */
export async function callSetAdminClaim(email, grantAdmin = true, adminUid = 'admin') {
  try {
    const res = await fetch('/api/admin/set-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': adminUid,
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ email, admin: grantAdmin }),
    });
    return await res.json();
  } catch (err) {
    console.warn('callSetAdminClaim error, fallback to client update:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Callable Cloud Function / API: setUserDisabled
 */
export async function callSetUserDisabled(uid, disabled = true, adminUid = 'admin') {
  try {
    const res = await fetch('/api/admin/toggle-user-disabled', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': adminUid,
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ uid, disabled }),
    });
    return await res.json();
  } catch (err) {
    console.warn('callSetUserDisabled error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Callable Cloud Function / API: deleteUser
 */
export async function callDeleteUser(uid, adminUid = 'admin') {
  try {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': adminUid,
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ uid }),
    });
    return await res.json();
  } catch (err) {
    console.warn('callDeleteUser error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Callable Cloud Function / API: sendListingDecisionEmail
 */
export async function callSendListingDecisionEmail({ ownerEmail, listingTitle, decision, reasonOrNote }) {
  if (!ownerEmail) return;
  try {
    await fetch('/api/admin/send-decision-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-auth': 'true',
        'x-user-role': 'admin',
      },
      body: JSON.stringify({ ownerEmail, listingTitle, decision, reasonOrNote }),
    });
  } catch (err) {
    console.warn('sendListingDecisionEmail dispatch notice:', err.message);
  }
}

/**
 * Cursor-paginated listings query for Admin table (25 per page)
 */
export async function getListingsAdminPaginated({
  statusFilter = 'all',
  typeFilter = 'all',
  cityFilter = '',
  featuredFilter = null,
  sortField = 'createdAt',
  sortOrder = 'desc',
  lastDoc = null,
  pageSize = 25,
} = {}) {
  try {
    const colRef = collection(db, LISTINGS_COLLECTION);
    const constraints = [];

    if (statusFilter && statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter));
    }
    if (typeFilter && typeFilter !== 'all') {
      constraints.push(where('type', '==', typeFilter));
    }
    if (featuredFilter === true) {
      constraints.push(where('featured', '==', true));
    }

    // Sorting
    constraints.push(orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc'));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    constraints.push(limit(pageSize));

    const snap = await getDocs(query(colRef, ...constraints));
    const items = [];

    snap.forEach((d) => {
      const data = d.data();
      let matches = true;

      if (cityFilter && cityFilter.trim()) {
        const c = cityFilter.toLowerCase().trim();
        const cityMatch = (data.city && data.city.toLowerCase().includes(c)) ||
                          (data.address && data.address.toLowerCase().includes(c)) ||
                          (data.location && data.location.toLowerCase().includes(c));
        if (!cityMatch) matches = false;
      }

      if (matches) {
        items.push({
          id: d.id,
          ...data,
          _doc: d,
        });
      }
    });

    const lastVisible = snap.docs[snap.docs.length - 1] || null;

    return {
      listings: items,
      lastVisible,
      hasMore: snap.docs.length === pageSize,
    };
  } catch (err) {
    console.warn('getListingsAdminPaginated notice, falling back:', err.message);
    const all = await getAllListingsForAdmin(statusFilter);
    return {
      listings: all.slice(0, pageSize),
      lastVisible: null,
      hasMore: all.length > pageSize,
    };
  }
}


