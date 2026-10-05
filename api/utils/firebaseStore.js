import fs from 'fs';
import path from 'path';
import { mockStore } from './mockStore.js';

let dbInstance = null;
let isInitialized = false;

// In-memory cache synced with Firestore and seed listings
const listingsMap = new Map();
const usersMap = new Map();
const deletedListingIds = new Set();

// Helper to load Firebase configuration
export const getFirebaseConfig = () => {
  const rootPath = path.resolve();
  const configPath = path.join(rootPath, 'firebase-applet-config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn('Could not parse firebase-applet-config.json:', e.message);
    }
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || config.projectId || 'prismatic-notch-gxqhd',
    appId: process.env.FIREBASE_APP_ID || config.appId || '1:34995434560:web:3eabe86fc0b63d6083dba5',
    apiKey: process.env.FIREBASE_API_KEY || config.apiKey || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || config.authDomain || 'prismatic-notch-gxqhd.firebaseapp.com',
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId || 'ai-studio-chento100-47c359d5-20d4-448f-87db-e770c2421000',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || config.storageBucket || 'prismatic-notch-gxqhd.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId || '34995434560',
  };
};

// Helper to normalize listings with full schema compatibility across Main and Admin pages
export const normalizeListing = (data, id) => {
  const _id = id || data._id || data.id || `listing_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const title = data.title || data.name || 'Untitled Listing';
  const name = data.name || title;
  const address = data.address || data.location || data.city || 'City Center';
  const location = data.location || address;
  const city = data.city || location.split(',')[0].trim() || 'City Center';
  const area = data.area || '';
  const description = data.description || '';
  const regularPrice = data.regularPrice !== undefined ? Number(data.regularPrice) : Number(data.price || 0);
  const price = data.price !== undefined ? Number(data.price) : regularPrice;
  const discountPrice = Number(data.discountPrice || data.discountedPrice || 0);
  const discountedPrice = discountPrice;
  const offer = Boolean(data.offer || (discountPrice > 0 && discountPrice < regularPrice));

  let category = data.category;
  if (!category) {
    if (data.type === 'car' || data.type === 'car_service' || data.type === 'sale') {
      category = 'car_service';
    } else {
      category = 'guesthouse';
    }
  } else if (category === 'car') {
    category = 'car_service';
  }

  const type = (category === 'car_service' || data.type === 'car' || data.type === 'sale') ? 'car' : 'guesthouse';
  const status = data.status || (data.isApproved ? 'approved' : 'pending');
  const isApproved = status === 'approved';
  const active = data.active !== undefined ? Boolean(data.active) : (data.isActive !== undefined ? Boolean(data.isActive) : isApproved);
  const isActive = active;

  let imageUrls = data.images || data.imageUrls || data.imageURLs || [];
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    imageUrls = type === 'car'
      ? ['/images/city_regular_sedan.jpg', '/images/city_driver_car.jpg']
      : ['/images/airbnb_apartment_living.jpg', '/images/airbnb_apartment_bed.jpg'];
  }

  return {
    ...data,
    _id,
    id: _id,
    title,
    name,
    address,
    location,
    city,
    area,
    description,
    regularPrice,
    price,
    discountPrice,
    discountedPrice,
    priceUnit: data.priceUnit || (type === 'guesthouse' ? 'night' : 'day'),
    currency: data.currency || 'USD',
    offer,
    category,
    type,
    isApproved,
    status,
    active,
    isActive,
    featured: Boolean(data.featured),
    rejectionReason: data.rejectionReason || '',
    images: imageUrls,
    imageUrls,
    imageURLs: imageUrls,
    userRef: data.ownerId || data.userRef || 'user_guest',
    ownerId: data.ownerId || data.userRef || 'user_guest',
    ownerEmail: data.ownerEmail || '',
    contactPhone: data.contactPhone || '',
    bedrooms: Number(data.bedrooms || (type === 'guesthouse' ? 1 : 0)),
    bathrooms: Number(data.bathrooms || (type === 'guesthouse' ? 1 : 0)),
    maxGuests: Number(data.maxGuests || (type === 'guesthouse' ? 2 : 4)),
    furnished: data.furnished !== undefined ? Boolean(data.furnished) : true,
    parking: data.parking !== undefined ? Boolean(data.parking) : true,
    amenities: Array.isArray(data.amenities)
      ? data.amenities
      : (typeof data.amenities === 'string' && data.amenities ? data.amenities.split(',').map((s) => s.trim()).filter(Boolean) : ['WiFi', 'Air Conditioning']),
    make: data.make || '',
    model: data.model || '',
    year: Number(data.year || new Date().getFullYear()),
    transmission: data.transmission || 'automatic',
    fuel: data.fuel || 'Petrol',
    seats: Number(data.seats || 4),
    driverIncluded: data.driverIncluded !== undefined ? Boolean(data.driverIncluded) : (type === 'car'),
    driverName: data.driverName || '',
    driverContact: data.driverContact || '',
    viewCount: Number(data.viewCount || 0),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
};

// Seed store with initial marketplace items immediately
const seedInitialListings = () => {
  try {
    const seedItems = mockStore.getAllListings();
    for (const item of seedItems) {
      if (!deletedListingIds.has(item._id || item.id)) {
        const norm = normalizeListing(item);
        listingsMap.set(norm._id, norm);
      }
    }
    console.log(`[Firebase Store] Populated ${listingsMap.size} base listings into store`);
  } catch (err) {
    console.warn('[Firebase Store] Seed notice:', err.message);
  }
};

// Seed immediately on load
seedInitialListings();

export const initFirebaseStore = async () => {
  if (isInitialized) return;

  const config = getFirebaseConfig();
  console.log(`[Firebase Store] Initializing for Project: ${config.projectId}`);

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore, getDocs, collection, query, where } = await import('firebase/firestore');

    const appInstance = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    dbInstance = getFirestore(appInstance, config.firestoreDatabaseId);

    // Read existing approved listings from Firestore if available
    try {
      const q = query(collection(dbInstance, 'listings'), where('status', '==', 'approved'));
      const listingsSnapshot = await getDocs(q);
      if (!listingsSnapshot.empty) {
        listingsSnapshot.forEach((docSnap) => {
          if (!deletedListingIds.has(docSnap.id)) {
            const data = docSnap.data();
            const norm = normalizeListing(data, docSnap.id);
            listingsMap.set(norm._id, norm);
          }
        });
        console.log(`[Firebase Store] Synced Firestore approved listings. Total in store: ${listingsMap.size}`);
      }
    } catch (readErr) {
      console.log('[Firebase Store] Firestore public read info:', readErr.message);
    }
  } catch (err) {
    console.warn('[Firebase Store] Initialization notice:', err.message);
  }

  isInitialized = true;
};

// Auto initialize on module import safely
initFirebaseStore().catch((err) => console.error('[Firebase Store] Init notice:', err.message));

export const firebaseStore = {
  // Listings
  getListings: (queryObj = {}) => {
    if (listingsMap.size === 0) {
      seedInitialListings();
    }

    let list = Array.from(listingsMap.values()).filter((l) => !deletedListingIds.has(l._id));

    // Admin or specific all request bypasses approved-only check
    const isAllOrAdmin =
      queryObj.all === 'true' ||
      queryObj.isAdmin === 'true' ||
      queryObj.onlyApproved === false ||
      queryObj.filter === 'pending' ||
      queryObj.status === 'pending' ||
      queryObj.status === 'rejected';

    if (!isAllOrAdmin) {
      list = list.filter((l) => l.status === 'approved' && l.active !== false && l.isActive !== false);
    }

    // Status filter if requested
    if (queryObj.status && queryObj.status !== 'all') {
      if (queryObj.status === 'pending') {
        list = list.filter((l) => l.status === 'pending' || !l.isApproved);
      } else if (queryObj.status === 'approved') {
        list = list.filter((l) => l.status === 'approved' && Boolean(l.isApproved));
      } else if (queryObj.status === 'rejected') {
        list = list.filter((l) => l.status === 'rejected');
      }
    } else if (queryObj.filter === 'pending') {
      list = list.filter((l) => l.status === 'pending' || !l.isApproved);
    }

    // Type filter
    if (queryObj.type && queryObj.type !== 'all') {
      const t = queryObj.type.toLowerCase();
      if (t === 'guesthouse' || t === 'rent') {
        list = list.filter((l) => l.type === 'guesthouse' || l.category === 'guesthouse' || l.type === 'rent');
      } else if (t === 'car' || t === 'car_service' || t === 'sale') {
        list = list.filter((l) => l.type === 'car' || l.category === 'car_service' || l.type === 'sale');
      }
    }

    // Featured filter
    if (queryObj.featured === 'true' || queryObj.featured === true) {
      list = list.filter((l) => l.featured === true);
    }

    // Search query
    if (queryObj.searchTerm || queryObj.city) {
      const term = (queryObj.searchTerm || queryObj.city).toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          l.location.toLowerCase().includes(term) ||
          (l.city && l.city.toLowerCase().includes(term))
      );
    }

    const sort = queryObj.sort || 'createdAt';
    const order = queryObj.order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sort === 'price') return (a.price - b.price) * order;
      return (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)) * order;
    });

    const startIndex = parseInt(queryObj.startIndex, 10) || 0;
    const limit = parseInt(queryObj.limit, 10) || (isAllOrAdmin ? 500 : 24);
    return list.slice(startIndex, startIndex + limit);
  },

  getListing: (id) => {
    if (deletedListingIds.has(id)) return null;
    return listingsMap.get(id) || null;
  },

  createListing: (data) => {
    const listing = normalizeListing(data);
    listingsMap.set(listing._id, listing);
    mockStore.createListing(listing);
    return listing;
  },

  updateListing: (id, updates) => {
    if (deletedListingIds.has(id)) return null;
    const existing = listingsMap.get(id) || mockStore.getListing(id);
    if (!existing) return null;
    const updated = normalizeListing({ ...existing, ...updates, updatedAt: new Date().toISOString() }, id);
    listingsMap.set(id, updated);
    mockStore.updateListing(id, updated);
    return updated;
  },

  deleteListing: (id) => {
    deletedListingIds.add(id);
    listingsMap.delete(id);
    mockStore.deleteListing(id);
    return true;
  },

  getUserListings: (userId) => {
    return Array.from(listingsMap.values()).filter(
      (l) => (l.userRef === userId || l.ownerId === userId) && !deletedListingIds.has(l._id)
    );
  },

  // Admin Operations
  getAdminListings: () => {
    return Array.from(listingsMap.values()).filter((l) => !deletedListingIds.has(l._id));
  },

  approveListing: (id) => {
    if (deletedListingIds.has(id)) return null;
    const existing = listingsMap.get(id) || mockStore.getListing(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'approved',
      isApproved: true,
      active: true,
      isActive: true,
      rejectionReason: '',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    listingsMap.set(id, updated);
    mockStore.updateListing(id, updated);
    return updated;
  },

  rejectListing: (id, reason = '') => {
    if (deletedListingIds.has(id)) return null;
    const existing = listingsMap.get(id) || mockStore.getListing(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'rejected',
      isApproved: false,
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    };
    listingsMap.set(id, updated);
    mockStore.updateListing(id, updated);
    return updated;
  },

  getAdminStats: () => {
    const list = Array.from(listingsMap.values()).filter((l) => !deletedListingIds.has(l._id));
    return {
      totalUsers: usersMap.size,
      totalListings: list.length,
      pendingCount: list.filter((l) => l.status === 'pending' || !l.isApproved).length,
      approvedCount: list.filter((l) => l.status === 'approved' && l.isApproved).length,
      rejectedCount: list.filter((l) => l.status === 'rejected').length,
    };
  },

  // Users
  getUser: (id) => usersMap.get(id) || null,
  getUserByEmail: (email) => {
    if (!email) return null;
    return Array.from(usersMap.values()).find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  },
  createUser: (userData) => {
    const _id = userData._id || `user_${Date.now()}`;
    const user = { ...userData, _id, id: _id };
    usersMap.set(_id, user);
    return user;
  },
  updateUser: (id, updates) => {
    const existing = usersMap.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    usersMap.set(id, updated);
    return updated;
  },
  deleteUser: (id) => usersMap.delete(id),
  getAllUsers: () => Array.from(usersMap.values()),
};

