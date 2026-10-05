import mongoose from 'mongoose';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import { mockStore } from '../utils/mockStore.js';
import { firebaseStore } from '../utils/firebaseStore.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * 3. GET /api/admin/listings
 * Fetch listings filtered by isApproved / status or all listings
 */
export const getAdminListings = async (req, res, next) => {
  try {
    let list = firebaseStore.getListings({
      all: 'true',
      isAdmin: 'true',
      limit: 500,
    });

    if (req.query.isApproved !== undefined) {
      const filterApproved = req.query.isApproved === 'true';
      list = list.filter((item) => {
        const isAppr = Boolean(item.isApproved || item.status === 'approved');
        return isAppr === filterApproved;
      });
    } else if (req.query.status === 'pending' || req.query.filter === 'pending') {
      list = list.filter((item) => !item.isApproved || item.status === 'pending');
    } else if (req.query.status === 'approved' || req.query.filter === 'approved') {
      list = list.filter((item) => Boolean(item.isApproved || item.status === 'approved'));
    } else if (req.query.status === 'rejected' || req.query.filter === 'rejected') {
      list = list.filter((item) => item.status === 'rejected');
    }

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.status(200).json(list);
  } catch (error) {
    console.warn('firebaseStore getAdminListings error, fallback to mockStore:', error.message);
  }

  try {
    let list = mockStore.getAllListings();
    if (req.query.isApproved !== undefined) {
      const filterApproved = req.query.isApproved === 'true';
      list = list.filter((item) => {
        const isAppr = Boolean(item.isApproved || item.status === 'approved');
        return isAppr === filterApproved;
      });
    } else if (req.query.status === 'pending' || req.query.filter === 'pending') {
      list = list.filter((item) => !item.isApproved || item.status === 'pending');
    } else if (req.query.status === 'approved' || req.query.filter === 'approved') {
      list = list.filter((item) => Boolean(item.isApproved || item.status === 'approved'));
    } else if (req.query.status === 'rejected' || req.query.filter === 'rejected') {
      list = list.filter((item) => item.status === 'rejected');
    }
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

/**
 * Alias for getAdminListings
 */
export const getAllListings = getAdminListings;

/**
 * GET /api/admin/listings/pending (backwards compatibility)
 */
export const getPendingListings = async (req, res, next) => {
  try {
    const list = firebaseStore.getListings({ all: 'true', isAdmin: 'true', limit: 500 });
    const pending = list.filter((item) => !item.isApproved || item.status === 'pending');
    return res.status(200).json(pending);
  } catch (error) {
    console.warn('firebaseStore getPendingListings notice, fallback to mockStore:', error.message);
  }

  try {
    const mockListings = mockStore.getPendingListings();
    return res.status(200).json(mockListings);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. PUT /api/admin/approve/:id (sets isApproved: true)
 */
export const approveListing = async (req, res, next) => {
  const id = req.params.id;
  try {
    const updated = firebaseStore.updateListing(id, {
      isApproved: true,
      status: 'approved',
    });
    mockStore.updateListing(id, {
      isApproved: true,
      status: 'approved',
    });

    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, { isApproved: true, status: 'approved' }, { new: true }).catch(() => {});
    }
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/reject/:id (sets isApproved: false, status: 'rejected')
 */
export const rejectListing = async (req, res, next) => {
  const id = req.params.id;
  try {
    const updated = firebaseStore.updateListing(id, {
      isApproved: false,
      status: 'rejected',
    });
    mockStore.updateListing(id, {
      isApproved: false,
      status: 'rejected',
    });

    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, { isApproved: false, status: 'rejected' }, { new: true }).catch(() => {});
    }
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. PUT /api/admin/toggle-status/:id (toggles the isActive boolean property)
 */
export const toggleStatusListing = async (req, res, next) => {
  const id = req.params.id;
  try {
    const existing = firebaseStore.getListing(id) || mockStore.getListing(id);
    if (!existing) {
      return next(errorHandler(404, 'Listing not found!'));
    }
    const currentActive =
      existing.isActive !== undefined
        ? existing.isActive
        : existing.active !== undefined
        ? existing.active
        : true;
    const newActive = !currentActive;

    const updated = firebaseStore.updateListing(id, {
      isActive: newActive,
      active: newActive,
    });
    mockStore.updateListing(id, {
      isActive: newActive,
      active: newActive,
    });

    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, { isActive: newActive, active: newActive }, { new: true }).catch(() => {});
    }
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Alias for toggleStatusListing
 */
export const toggleActiveListing = toggleStatusListing;

/**
 * GET /api/admin/users
 */
export const getUsers = async (req, res, next) => {
  try {
    const allUsers = firebaseStore.getAllUsers();
    return res.status(200).json(allUsers);
  } catch (error) {
    const mockUsers = mockStore.getAllUsers().map((user) => {
      const { password, ...rest } = user;
      return rest;
    });
    return res.status(200).json(mockUsers);
  }
};

/**
 * POST /api/admin/listings or POST /api/admin/create
 * Allows administrator to create a new listing directly.
 * Default status is 'approved' and active is true unless specified otherwise.
 */
export const adminCreateListing = async (req, res, next) => {
  try {
    const isApproved =
      req.body.isApproved !== undefined
        ? Boolean(req.body.isApproved)
        : req.body.status === 'pending'
        ? false
        : true; // Admin creates approved listings by default
    const status = req.body.status || (isApproved ? 'approved' : 'pending');
    const active = req.body.active !== undefined ? Boolean(req.body.active) : true;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : active;

    const rawCategory = req.body.category || (req.body.type === 'sale' ? 'car_service' : 'guesthouse');
    const category = rawCategory === 'car' ? 'car_service' : rawCategory;

    const regularPrice = req.body.regularPrice !== undefined ? Number(req.body.regularPrice) : Number(req.body.price || 0);
    const price = req.body.price !== undefined ? Number(req.body.price) : regularPrice;
    const discountPrice = Number(req.body.discountPrice || 0);

    const title = req.body.title || req.body.name || 'Untitled Listing';
    const name = req.body.name || req.body.title || 'Untitled Listing';
    const address = req.body.address || req.body.location || 'City Center';
    const location = req.body.location || req.body.address || 'City Center';

    let imageUrls = req.body.imageUrls || req.body.imageURLs || [];
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      imageUrls = category === 'car_service'
        ? ['/images/city_regular_sedan.jpg', '/images/city_driver_car.jpg']
        : ['/images/airbnb_apartment_living.jpg', '/images/airbnb_apartment_bed.jpg'];
    }

    const listingData = {
      ...req.body,
      title,
      name,
      address,
      location,
      category,
      type: category === 'car_service' ? 'sale' : 'rent',
      regularPrice,
      price,
      discountPrice,
      offer: Boolean(req.body.offer || (discountPrice > 0 && discountPrice < regularPrice)),
      status,
      isApproved,
      active,
      isActive,
      imageUrls,
      imageURLs: imageUrls,
      userRef: req.user?.id || req.body.userRef || 'admin_master',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const listing = firebaseStore.createListing(listingData);
    mockStore.createListing(listingData);

    if (isDbConnected()) {
      Listing.create(listingData).catch(() => {});
    }

    return res.status(201).json(listing);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/listings/:id
 * Allows administrator to delete any current or future listing permanently from backend & Firestore.
 */
export const adminDeleteListing = async (req, res, next) => {
  const { id } = req.params;
  try {
    console.log(`[Admin] Ultimate powers executed: Permanently deleting listing ${id} from backend database...`);

    // 1. Delete from Firestore and in-memory cache
    await firebaseStore.deleteListing(id);

    // 2. Delete from mockStore cache
    mockStore.deleteListing(id);

    // 3. Delete from MongoDB if connected
    if (isDbConnected()) {
      await Promise.allSettled([
        Listing.findByIdAndDelete(id),
        Listing.deleteOne({ _id: id }),
      ]);
    }

    return res.status(200).json({
      success: true,
      message: 'Listing has been permanently deleted from backend database!',
      deletedId: id,
    });
  } catch (error) {
    console.error('[Admin] Error deleting listing:', error);
    next(error);
  }
};

/**
 * PUT /api/admin/listings/:id or POST /api/admin/listings/:id
 * Allows administrator to edit any current or future listing.
 */
export const adminUpdateListing = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (isDbConnected()) {
      const listing = await Listing.findById(id);
      if (listing) {
        const updated = await Listing.findByIdAndUpdate(
          id,
          req.body,
          { new: true }
        );
        mockStore.updateListing(id, req.body);
        return res.status(200).json(updated);
      }
    }
  } catch (error) {
    console.warn('DB adminUpdateListing error, fallback to mockStore:', error.message);
  }

  const mockItem = mockStore.getListing(id);
  if (!mockItem) {
    return next(errorHandler(404, 'Listing not found!'));
  }
  const updated = mockStore.updateListing(id, req.body);
  return res.status(200).json(updated);
};

/**
 * GET /api/admin/listings/:id
 * Admin listing inspection endpoint
 */
export const adminGetListing = async (req, res, next) => {
  const { id } = req.params;

  if (id === 'pending') {
    return getPendingListings(req, res, next);
  }
  if (id === 'all') {
    return getAllListings(req, res, next);
  }

  const item = firebaseStore.getListing(id) || mockStore.getListing(id);
  if (item) return res.status(200).json(item);

  try {
    if (isDbConnected()) {
      const listing = await Listing.findById(id);
      if (listing) return res.status(200).json(listing);
    }
  } catch (error) {
    console.warn('DB adminGetListing error, fallback to mockStore:', error.message);
  }

  return next(errorHandler(404, 'Listing not found!'));
};
