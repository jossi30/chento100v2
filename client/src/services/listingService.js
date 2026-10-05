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
 * Fetch approved listings with filtering, sorting, and cursor pagination
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
  try {
    let q = collection(db, LISTINGS_COLLECTION);
    const constraints = [where('status', '==', 'approved')];

    if (type && type !== 'all') {
      constraints.push(where('type', '==', type));
    }

    if (sortBy === 'price_asc') {
      constraints.push(orderBy('price', 'asc'));
    } else if (sortBy === 'price_desc') {
      constraints.push(orderBy('price', 'desc'));
    } else {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    constraints.push(limit(pageSize));

    const querySnapshot = await getDocs(query(q, ...constraints));
    const items = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let matches = true;

      // In-memory refinement for secondary filters
      if (city && city.trim() && data.city) {
        if (!data.city.toLowerCase().includes(city.toLowerCase().trim()) &&
            !data.location?.toLowerCase().includes(city.toLowerCase().trim())) {
          matches = false;
        }
      }

      if (minPrice !== null && minPrice !== undefined && Number(data.price) < Number(minPrice)) {
        matches = false;
      }
      if (maxPrice !== null && maxPrice !== undefined && Number(data.price) > Number(maxPrice)) {
        matches = false;
      }

      if (bedrooms && data.type === 'guesthouse' && Number(data.bedrooms) < Number(bedrooms)) {
        matches = false;
      }

      if (seats && data.type === 'car' && Number(data.seats) < Number(seats)) {
        matches = false;
      }

      if (driverIncluded !== null && data.type === 'car' && Boolean(data.driverIncluded) !== Boolean(driverIncluded)) {
        matches = false;
      }

      if (amenities && amenities.length > 0 && data.amenities) {
        const itemAmenities = Array.isArray(data.amenities) ? data.amenities : [];
        const hasAll = amenities.every((a) =>
          itemAmenities.some((ia) => ia.toLowerCase().includes(a.toLowerCase()))
        );
        if (!hasAll) matches = false;
      }

      if (matches) {
        items.push({
          id: docSnap.id,
          ...data,
          _doc: docSnap,
        });
      }
    });

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    return {
      listings: items,
      lastVisible,
      hasMore: querySnapshot.docs.length === pageSize,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return { listings: [], lastVisible: null, hasMore: false };
  }
}

/**
 * Fetch featured approved listings
 */
export async function getFeaturedListings(type = null, limitCount = 6) {
  try {
    const constraints = [
      where('status', '==', 'approved'),
      where('featured', '==', true),
      limit(limitCount),
    ];

    if (type) {
      constraints.unshift(where('type', '==', type));
    }

    const q = query(collection(db, LISTINGS_COLLECTION), ...constraints);
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Fetch recent approved listings for Home Page
 */
export async function getRecentApprovedListings(type = null, limitCount = 6) {
  try {
    const constraints = [
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    ];

    if (type) {
      constraints.unshift(where('type', '==', type));
    }

    const q = query(collection(db, LISTINGS_COLLECTION), ...constraints);
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Fetch single listing by ID and increment view count
 */
export async function getListingById(id) {
  try {
    const docRef = doc(db, LISTINGS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();

    // Increment view count non-blocking
    updateDoc(docRef, {
      viewCount: increment(1),
    }).catch(() => {});

    return { id: snap.id, ...data };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${LISTINGS_COLLECTION}/${id}`);
    return null;
  }
}

/**
 * Fetch all listings created by a specific user (My Listings)
 */
export async function getUserListings(userId) {
  try {
    const q = query(
      collection(db, LISTINGS_COLLECTION),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Create a new listing with strict 'pending' status
 */
export async function createListing(listingData, user) {
  if (!user) throw new Error('You must be signed in to create a listing.');

  const cleanData = {
    ...listingData,
    type: listingData.type || 'guesthouse',
    title: listingData.title?.trim() || '',
    description: listingData.description?.trim() || '',
    price: Number(listingData.price) || 0,
    priceUnit: listingData.priceUnit || (listingData.type === 'guesthouse' ? 'night' : 'day'),
    currency: listingData.currency || 'USD',
    city: listingData.city?.trim() || '',
    area: listingData.area?.trim() || '',
    address: listingData.address?.trim() || listingData.city || '',
    images: Array.isArray(listingData.images) ? listingData.images.slice(0, 8) : [],
    ownerId: user.uid,
    ownerEmail: user.email || '',
    contactPhone: listingData.contactPhone?.trim() || '',
    status: 'pending', // Rule 4: Every new listing is created with status "pending"
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

  try {
    const docRef = await addDoc(collection(db, LISTINGS_COLLECTION), cleanData);
    return { id: docRef.id, ...cleanData };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, LISTINGS_COLLECTION);
    throw err;
  }
}

/**
 * Update an existing listing
 */
export async function updateListing(id, updates, isAdmin = false) {
  const docRef = doc(db, LISTINGS_COLLECTION, id);

  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Prevent regular users from self-approving or altering admin properties
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
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${id}`);
    throw err;
  }
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
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${id}`);
    throw err;
  }
}

/**
 * Permanent delete listing
 */
export async function deleteListing(id) {
  const docRef = doc(db, LISTINGS_COLLECTION, id);
  try {
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${LISTINGS_COLLECTION}/${id}`);
    throw err;
  }
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
 * Get dashboard stats calculated from live Firestore queries
 */
export async function getAdminStats() {
  try {
    const listingsSnap = await getDocs(collection(db, LISTINGS_COLLECTION));
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let archivedCount = 0;

    listingsSnap.forEach((d) => {
      const data = d.data();
      if (data.status === 'pending') pendingCount++;
      else if (data.status === 'approved') approvedCount++;
      else if (data.status === 'rejected') rejectedCount++;
      else if (data.status === 'archived') archivedCount++;
    });

    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const reportsSnap = await getDocs(collection(db, REPORTS_COLLECTION));

    return {
      totalUsers: usersSnap.size,
      totalListings: listingsSnap.size,
      pendingCount,
      approvedCount,
      rejectedCount,
      archivedCount,
      openReportsCount: reportsSnap.size,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'adminStats');
    return {
      totalUsers: 0,
      totalListings: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      archivedCount: 0,
      openReportsCount: 0,
    };
  }
}

/**
 * Fetch all pending listings for admin queue
 */
export async function getPendingListings() {
  try {
    const q = query(
      collection(db, LISTINGS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Fetch all listings for management table
 */
export async function getAllListingsForAdmin(statusFilter = 'all') {
  try {
    let q = query(collection(db, LISTINGS_COLLECTION), orderBy('createdAt', 'desc'));
    if (statusFilter && statusFilter !== 'all') {
      q = query(
        collection(db, LISTINGS_COLLECTION),
        where('status', '==', statusFilter),
        orderBy('createdAt', 'desc')
      );
    }
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, LISTINGS_COLLECTION);
    return [];
  }
}

/**
 * Approve a pending listing
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

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
    throw err;
  }
}

/**
 * Reject a pending listing with required reason
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

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
    throw err;
  }
}

/**
 * Toggle featured flag on listing
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

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${LISTINGS_COLLECTION}/${listingId}`);
    throw err;
  }
}

/**
 * Get all users for admin users table
 */
export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const list = [];
    snap.forEach((d) => list.push({ uid: d.id, ...d.data() }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, USERS_COLLECTION);
    return [];
  }
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

