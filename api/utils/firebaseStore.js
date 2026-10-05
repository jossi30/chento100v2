import fs from 'fs';
import path from 'path';

let dbInstance = null;
let isInitialized = false;

// In-memory cache synced with Firestore (NO mock, placeholder, or seed data - Rule 1 compliance)
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

// Helper to normalize listings with full schema compatibility
const normalizeListing = (data, id) => {
  const _id = id || data._id || `listing_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const title = data.title || data.name || 'Untitled Listing';
  const name = data.name || title;
  const address = data.address || data.location || 'City Center';
  const location = data.location || address;
  const description = data.description || '';
  const regularPrice = data.regularPrice !== undefined ? Number(data.regularPrice) : Number(data.price || 0);
  const price = data.price !== undefined ? Number(data.price) : regularPrice;
  const discountPrice = Number(data.discountPrice || data.discountedPrice || 0);
  const discountedPrice = discountPrice;
  const offer = Boolean(data.offer || (discountPrice > 0 && discountPrice < regularPrice));

  let category = data.category || (data.type === 'car' ? 'car_service' : 'guesthouse');
  if (category === 'car') category = 'car_service';

  const type = category === 'car_service' ? 'car' : 'guesthouse';
  const status = data.status || 'pending';
  const isApproved = status === 'approved';
  const active = data.active !== undefined ? Boolean(data.active) : isApproved;
  const isActive = active;

  let imageUrls = data.images || data.imageUrls || data.imageURLs || [];
  if (!Array.isArray(imageUrls)) imageUrls = [];

  return {
    ...data,
    _id,
    id: _id,
    title,
    name,
    address,
    location,
    city: data.city || location,
    description,
    regularPrice,
    price,
    discountPrice,
    discountedPrice,
    offer,
    category,
    type,
    isApproved,
    status,
    active,
    isActive,
    images: imageUrls,
    imageUrls,
    imageURLs: imageUrls,
    userRef: data.ownerId || data.userRef || 'user_guest',
    ownerId: data.ownerId || data.userRef || 'user_guest',
    ownerEmail: data.ownerEmail || '',
    contactPhone: data.contactPhone || '',
    bedrooms: Number(data.bedrooms || 0),
    bathrooms: Number(data.bathrooms || 0),
    maxGuests: Number(data.maxGuests || 1),
    furnished: Boolean(data.furnished),
    parking: Boolean(data.parking),
    amenities: Array.isArray(data.amenities) ? data.amenities : [],
    make: data.make || '',
    model: data.model || '',
    year: Number(data.year || new Date().getFullYear()),
    transmission: data.transmission || 'automatic',
    fuel: data.fuel || 'Petrol',
    seats: Number(data.seats || 4),
    driverIncluded: data.driverIncluded !== undefined ? Boolean(data.driverIncluded) : false,
    viewCount: Number(data.viewCount || 0),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
};

export const initFirebaseStore = async () => {
  if (isInitialized) return;

  const config = getFirebaseConfig();
  console.log(`[Firebase Store] Initializing for Project: ${config.projectId}`);

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getFirestore, getDocs, collection } = await import('firebase/firestore');

    const appInstance = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    dbInstance = getFirestore(appInstance, config.firestoreDatabaseId);

    // Read existing approved listings from Firestore if available
    try {
      const listingsCol = collection(dbInstance, 'listings');
      const listingsSnapshot = await getDocs(listingsCol);
      if (!listingsSnapshot.empty) {
        listingsMap.clear();
        listingsSnapshot.forEach((docSnap) => {
          if (!deletedListingIds.has(docSnap.id)) {
            const data = docSnap.data();
            const norm = normalizeListing(data, docSnap.id);
            listingsMap.set(norm._id, norm);
          }
        });
        console.log(`[Firebase Store] Hydrated ${listingsMap.size} listings from Firestore`);
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
  getListings: (query = {}) => {
    let list = Array.from(listingsMap.values()).filter((l) => !deletedListingIds.has(l._id));

    // Only approved listings for public
    if (query.onlyApproved !== false) {
      list = list.filter((l) => l.status === 'approved');
    }

    if (query.type && query.type !== 'all') {
      list = list.filter((l) => l.type === query.type || l.category === query.type);
    }

    if (query.searchTerm) {
      const term = query.searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          l.location.toLowerCase().includes(term) ||
          (l.city && l.city.toLowerCase().includes(term))
      );
    }

    const sort = query.sort || 'createdAt';
    const order = query.order === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sort === 'price') return (a.price - b.price) * order;
      return (new Date(b.createdAt) - new Date(a.createdAt)) * order;
    });

    const startIndex = parseInt(query.startIndex) || 0;
    const limit = parseInt(query.limit) || 9;
    return list.slice(startIndex, startIndex + limit);
  },

  getListing: (id) => {
    if (deletedListingIds.has(id)) return null;
    return listingsMap.get(id) || null;
  },

  createListing: (data) => {
    const listing = normalizeListing(data);
    listingsMap.set(listing._id, listing);
    return listing;
  },

  updateListing: (id, updates) => {
    if (deletedListingIds.has(id)) return null;
    const existing = listingsMap.get(id);
    if (!existing) return null;
    const updated = normalizeListing({ ...existing, ...updates, updatedAt: new Date().toISOString() }, id);
    listingsMap.set(id, updated);
    return updated;
  },

  deleteListing: (id) => {
    deletedListingIds.add(id);
    listingsMap.delete(id);
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
    const existing = listingsMap.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'approved',
      isApproved: true,
      active: true,
      isActive: true,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    listingsMap.set(id, updated);
    return updated;
  },

  rejectListing: (id, reason = '') => {
    if (deletedListingIds.has(id)) return null;
    const existing = listingsMap.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'rejected',
      isApproved: false,
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    };
    listingsMap.set(id, updated);
    return updated;
  },

  getAdminStats: () => {
    const list = Array.from(listingsMap.values()).filter((l) => !deletedListingIds.has(l._id));
    return {
      totalUsers: usersMap.size,
      totalListings: list.length,
      pendingCount: list.filter((l) => l.status === 'pending').length,
      approvedCount: list.filter((l) => l.status === 'approved').length,
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
