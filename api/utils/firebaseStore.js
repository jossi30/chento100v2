import { storage, normalizeListing } from './storage.js';
import { mockStore } from './mockStore.js';
import fs from 'fs';
import path from 'path';

export { normalizeListing };

export const getFirebaseConfig = () => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        projectId: data.projectId || process.env.VITE_FIREBASE_PROJECT_ID || 'chento100',
        firestoreDatabaseId: data.firestoreDatabaseId || process.env.VITE_FIRESTORE_DATABASE_ID || '(default)',
      };
    }
  } catch {
    // ignore
  }
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'chento100',
    firestoreDatabaseId: process.env.VITE_FIRESTORE_DATABASE_ID || '(default)',
  };
};

export const initFirebaseStore = async () => {
  return true;
};

export const firebaseStore = {
  getListings: (queryObj = {}) => storage.getListings(queryObj),
  getListing: (id) => storage.getListing(id),
  createListing: (data) => storage.createListing(data),
  updateListing: (id, updates) => storage.updateListing(id, updates),
  deleteListing: (id) => storage.deleteListing(id),
  approveListing: (id) => storage.approveListing(id),
  rejectListing: (id, reason) => storage.rejectListing(id, reason),
  toggleStatusListing: (id) => storage.toggleStatusListing(id),
  toggleFeaturedListing: (id) => storage.toggleFeaturedListing(id),

  // User management
  getUser: (id) => mockStore.findUserById(id),
  getUserByEmail: (email) => mockStore.findUserByEmail(email),
  createUser: (data) => mockStore.createUser(data),
  updateUser: (id, updates) => mockStore.updateUser(id, updates),
  getUsers: () => Array.from(mockStore.users.values()),

  getAdminStats: () => {
    const list = storage.getAllListings();
    const guesthouses = list.filter((l) => l.category === 'guesthouse' || l.type === 'guesthouse' || l.type === 'rent');
    const cars = list.filter((l) => l.category === 'car_service' || l.category === 'car' || l.type === 'car' || l.type === 'sale');

    return {
      totalUsers: 8,
      totalHosts: 4,
      totalGuests: 4,
      totalListings: list.length,
      pendingCount: list.filter((l) => l.status === 'pending' || !l.isApproved).length,
      approvedCount: list.filter((l) => l.status === 'approved' && l.isApproved).length,
      rejectedCount: list.filter((l) => l.status === 'rejected').length,
      guesthouses: {
        total: guesthouses.length,
        approved: guesthouses.filter((l) => l.status === 'approved' && l.isApproved).length,
        pending: guesthouses.filter((l) => l.status === 'pending' || !l.isApproved).length,
        active: guesthouses.filter((l) => l.active !== false && l.isActive !== false).length,
      },
      cars: {
        total: cars.length,
        approved: cars.filter((l) => l.status === 'approved' && l.isApproved).length,
        pending: cars.filter((l) => l.status === 'pending' || !l.isApproved).length,
        active: cars.filter((l) => l.active !== false && l.isActive !== false).length,
      },
    };
  },
};
