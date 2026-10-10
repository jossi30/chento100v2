import fs from 'fs';
import path from 'path';

const resolveDataDir = () => {
  const rootData = path.join(process.cwd(), 'api', 'data');
  if (fs.existsSync(rootData)) return rootData;
  const directData = path.join(process.cwd(), 'data');
  if (fs.existsSync(directData)) return directData;
  return rootData;
};
const DATA_DIR = resolveDataDir();
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const listingsMap = new Map();
const usersMap = new Map();

// Helper to normalize listing
export const normalizeListing = (data, id) => {
  const _id = id || data._id || data.id || `listing_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const title = data.title || data.name || 'Untitled Listing';
  const name = data.name || title;
  const address = data.address || data.location || data.city || 'Makindye Division, Kampala';
  const location = data.location || address;
  const city = data.city || location.split(',')[0].trim() || 'Makindye';
  const area = data.area || '';
  const description = data.description || '';
  const regularPrice = data.regularPrice !== undefined ? Number(data.regularPrice) : Number(data.price || 0);
  const price = data.price !== undefined ? Number(data.price) : regularPrice;
  const discountPrice = Number(data.discountPrice || data.discountedPrice || 0);
  const discountedPrice = discountPrice;
  const offer = data.offer !== undefined ? Boolean(data.offer) : Boolean(discountPrice > 0 && discountPrice < regularPrice);

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
    ownerName: data.ownerName || 'Verified Host',
    ownerEmail: data.ownerEmail || 'contact@chento100.com',
    contactPhone: data.contactPhone || '+1 305-555-8821',
    bedrooms: Number(data.bedrooms || (type === 'guesthouse' ? 1 : 0)),
    bathrooms: Number(data.bathrooms || (type === 'guesthouse' ? 1 : 0)),
    maxGuests: Number(data.maxGuests || (type === 'guesthouse' ? 2 : 4)),
    amenities: Array.isArray(data.amenities)
      ? data.amenities
      : ['WiFi', 'Air Conditioning'],
    make: data.make || '',
    model: data.model || '',
    year: Number(data.year || new Date().getFullYear()),
    transmission: data.transmission || 'automatic',
    fuel: data.fuel || 'Petrol',
    seats: Number(data.seats || 4),
    driverIncluded: data.driverIncluded !== undefined ? Boolean(data.driverIncluded) : (type === 'car'),
    driverName: data.driverName || 'Verified Driver',
    driverContact: data.driverContact || data.contactPhone || '+1 305-555-0199',
    viewCount: Number(data.viewCount || 0),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
};

// Save listings to disk synchronously
const saveListingsToDisk = () => {
  try {
    const list = Array.from(listingsMap.values());
    fs.writeFileSync(LISTINGS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage Engine] Failed to save listings to disk:', err.message);
  }
};

// Load listings from disk on startup
const loadListingsFromDisk = () => {
  try {
    if (fs.existsSync(LISTINGS_FILE)) {
      const content = fs.readFileSync(LISTINGS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        listingsMap.clear();
        for (const item of parsed) {
          const norm = normalizeListing(item);
          listingsMap.set(norm._id, norm);
        }
        console.log(`[Storage Engine] Successfully loaded ${listingsMap.size} persistent listings from disk.`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Storage Engine] Read error, creating fresh persistent store:', err.message);
  }
};

loadListingsFromDisk();

export const storage = {
  getAllListings() {
    return Array.from(listingsMap.values());
  },

  getListings(queryObj = {}) {
    let list = Array.from(listingsMap.values());

    // Search term
    if (queryObj.searchTerm && typeof queryObj.searchTerm === 'string') {
      const term = queryObj.searchTerm.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.title?.toLowerCase().includes(term) ||
          item.name?.toLowerCase().includes(term) ||
          item.city?.toLowerCase().includes(term) ||
          item.address?.toLowerCase().includes(term) ||
          item.location?.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term) ||
          item.make?.toLowerCase().includes(term) ||
          item.model?.toLowerCase().includes(term)
        );
      });
    }

    // Status filter
    const isAllOrAdmin =
      queryObj.all === 'true' ||
      queryObj.isAdmin === 'true' ||
      queryObj.onlyApproved === false;

    if (!isAllOrAdmin) {
      list = list.filter((item) => (item.status === 'approved' || item.isApproved === true) && item.active !== false && item.isActive !== false);
    } else {
      if (queryObj.status && queryObj.status !== 'all') {
        list = list.filter((item) => item.status === queryObj.status);
      }
      if (queryObj.isApproved !== undefined) {
        const reqApp = queryObj.isApproved === 'true';
        list = list.filter((item) => Boolean(item.isApproved || item.status === 'approved') === reqApp);
      }
    }

    // Category / Type filter
    let typeFilter = queryObj.type || queryObj.category;
    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'guesthouse' || typeFilter === 'rent') {
        list = list.filter((item) => item.type === 'guesthouse' || item.category === 'guesthouse' || item.type === 'rent');
      } else if (typeFilter === 'car' || typeFilter === 'car_service' || typeFilter === 'sale') {
        list = list.filter((item) => item.type === 'car' || item.category === 'car_service' || item.category === 'car' || item.type === 'sale');
      }
    }

    // City filter
    if (queryObj.city && typeof queryObj.city === 'string' && queryObj.city.trim()) {
      const c = queryObj.city.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.city?.toLowerCase().includes(c) ||
          item.location?.toLowerCase().includes(c) ||
          item.address?.toLowerCase().includes(c) ||
          item.area?.toLowerCase().includes(c)
        );
      });
    }

    // Offer / Promo filter
    if (queryObj.offer === 'true') {
      list = list.filter((item) => Boolean(item.offer) || (Number(item.discountPrice) > 0 && Number(item.discountPrice) < Number(item.regularPrice)));
    }

    // Featured filter
    if (queryObj.featured === 'true') {
      list = list.filter((item) => Boolean(item.featured));
    }

    // User / Owner filter
    if (queryObj.userRef) {
      list = list.filter((item) => item.userRef === queryObj.userRef || item.ownerId === queryObj.userRef);
    }

    // Price filters
    if (queryObj.minPrice !== undefined && queryObj.minPrice !== null && queryObj.minPrice !== '') {
      const min = Number(queryObj.minPrice);
      if (!isNaN(min)) list = list.filter((item) => Number(item.price) >= min);
    }
    if (queryObj.maxPrice !== undefined && queryObj.maxPrice !== null && queryObj.maxPrice !== '') {
      const max = Number(queryObj.maxPrice);
      if (!isNaN(max)) list = list.filter((item) => Number(item.price) <= max);
    }

    // Sort
    const sort = queryObj.sort || queryObj.sortBy || 'createdAt';
    const order = queryObj.order || 'desc';

    if (sort === 'price' || sort === 'regularPrice') {
      list.sort((a, b) => order === 'asc' ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price));
    } else {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // Limit
    if (queryObj.limit && !isNaN(Number(queryObj.limit))) {
      const limit = Number(queryObj.limit);
      list = list.slice(0, limit);
    }

    return list;
  },

  getListing(id) {
    if (!id) return null;
    return listingsMap.get(id) || null;
  },

  createListing(data) {
    const norm = normalizeListing(data);
    listingsMap.set(norm._id, norm);
    saveListingsToDisk();
    return norm;
  },

  updateListing(id, updates) {
    const existing = listingsMap.get(id);
    if (!existing) return null;

    const merged = normalizeListing({
      ...existing,
      ...updates,
      _id: id,
      id,
      updatedAt: new Date().toISOString(),
    });

    listingsMap.set(id, merged);
    saveListingsToDisk();
    return merged;
  },

  deleteListing(id) {
    const res = listingsMap.delete(id);
    if (res) saveListingsToDisk();
    return res;
  },

  approveListing(id) {
    const existing = listingsMap.get(id);
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
    saveListingsToDisk();
    return updated;
  },

  rejectListing(id, reason = 'Does not meet marketplace standards') {
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
    saveListingsToDisk();
    return updated;
  },

  toggleStatusListing(id) {
    const existing = listingsMap.get(id);
    if (!existing) return null;

    const currentActive = existing.active !== false && existing.isActive !== false;
    const newActive = !currentActive;

    const updated = {
      ...existing,
      active: newActive,
      isActive: newActive,
      updatedAt: new Date().toISOString(),
    };

    listingsMap.set(id, updated);
    saveListingsToDisk();
    return updated;
  },

  toggleFeaturedListing(id) {
    const existing = listingsMap.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      featured: !existing.featured,
      updatedAt: new Date().toISOString(),
    };

    listingsMap.set(id, updated);
    saveListingsToDisk();
    return updated;
  },

  getPendingListings() {
    return Array.from(listingsMap.values()).filter(
      (item) => item.status === 'pending' || !item.isApproved
    );
  },
};
