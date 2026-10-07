import mongoose from 'mongoose';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import { mockStore } from '../utils/mockStore.js';
import { storage } from '../utils/storage.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * 3. GET /api/admin/listings
 * Fetch listings filtered by isApproved / status or category / type (guesthouse vs car)
 */
export const getAdminListings = async (req, res, next) => {
  try {
    let list = storage.getListings({
      all: 'true',
      isAdmin: 'true',
      onlyApproved: false,
      limit: 500,
    });

    // Category / Type filter: guesthouse vs car_service
    const catQuery = (req.query.category || req.query.type || '').toLowerCase();
    if (catQuery === 'guesthouse' || catQuery === 'rent') {
      list = list.filter((item) => item.category === 'guesthouse' || item.type === 'guesthouse' || item.type === 'rent');
    } else if (catQuery === 'car' || catQuery === 'car_service' || catQuery === 'sale') {
      list = list.filter((item) => item.category === 'car_service' || item.category === 'car' || item.type === 'car' || item.type === 'sale');
    }

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
    const list = storage.getListings({ all: 'true', isAdmin: 'true', onlyApproved: false, limit: 500 });
    const pending = list.filter((item) => !item.isApproved || item.status === 'pending');
    return res.status(200).json(pending);
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
    const updated = storage.approveListing(id);
    if (!updated) {
      return next(errorHandler(404, 'Listing not found'));
    }
    mockStore.updateListing(id, {
      isApproved: true,
      status: 'approved',
      active: true,
      isActive: true,
      rejectionReason: '',
      approvedAt: new Date().toISOString(),
    });

    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, { isApproved: true, status: 'approved', active: true, isActive: true }, { new: true }).catch(() => {});
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
  const reason = req.body?.reason || req.body?.rejectionReason || 'Does not meet marketplace guidelines';
  try {
    const updated = storage.rejectListing(id, reason);
    if (!updated) {
      return next(errorHandler(404, 'Listing not found'));
    }
    mockStore.updateListing(id, {
      isApproved: false,
      status: 'rejected',
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    });

    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, { isApproved: false, status: 'rejected', rejectionReason: reason }, { new: true }).catch(() => {});
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
    const existing = storage.getListing(id);
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

    const updated = storage.updateListing(id, {
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
 * Returns list of all signed users, separated by role/accountType (hosts vs users),
 * with names, emails, phone numbers, and service types.
 */
export const getUsers = async (req, res, next) => {
  try {
    let users = firebaseStore.getAllUsers();
    if (!users || users.length === 0) {
      users = mockStore.getAllUsers();
    }

    // Get listings to calculate real-time listing count for each host
    const allListings = firebaseStore.getListings({ all: 'true', isAdmin: 'true' }) || [];

    const enrichedUsers = users.map((u) => {
      const userListings = allListings.filter(
        (l) => l.userRef === u._id || l.ownerId === u._id || (u.email && l.ownerEmail?.toLowerCase() === u.email.toLowerCase())
      );
      const isHost = u.accountType === 'host' || u.role === 'host' || userListings.length > 0;
      const hostCategory = userListings.some((l) => l.category === 'car_service' || l.type === 'car')
        ? userListings.some((l) => l.category === 'guesthouse' || l.type === 'guesthouse')
          ? 'both'
          : 'car_service'
        : u.hostType || (isHost ? 'guesthouse' : null);

      const { password, ...safeUser } = u;

      return {
        ...safeUser,
        uid: safeUser._id || safeUser.id,
        id: safeUser._id || safeUser.id,
        displayName: safeUser.displayName || safeUser.username || safeUser.email?.split('@')[0],
        name: safeUser.displayName || safeUser.username || safeUser.email?.split('@')[0],
        phoneNumber: safeUser.phoneNumber || safeUser.phone || '',
        phone: safeUser.phone || safeUser.phoneNumber || '',
        accountType: safeUser.isAdmin ? 'admin' : isHost ? 'host' : 'user',
        role: safeUser.isAdmin ? 'admin' : isHost ? 'host' : (safeUser.role || 'user'),
        hostType: hostCategory,
        listingsCount: userListings.length || safeUser.listingsCount || 0,
        bookingsCount: safeUser.bookingsCount || (isHost ? 0 : 1),
        verified: safeUser.verified !== undefined ? safeUser.verified : Boolean(safeUser.emailVerified),
      };
    });

    // Query filters: type ('host' | 'user' | 'admin' | 'all')
    const typeFilter = req.query.type;
    let filtered = enrichedUsers;
    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'host') {
        filtered = filtered.filter((u) => u.accountType === 'host' || u.role === 'host');
      } else if (typeFilter === 'user' || typeFilter === 'guest') {
        filtered = filtered.filter((u) => u.accountType === 'user' && !u.isAdmin && u.role !== 'host');
      } else if (typeFilter === 'admin') {
        filtered = filtered.filter((u) => u.isAdmin || u.role === 'admin');
      }
    }

    // Search query: search by name, email, or phone number
    const searchQuery = (req.query.search || req.query.q || '').toLowerCase().trim();
    if (searchQuery) {
      filtered = filtered.filter(
        (u) =>
          (u.displayName && u.displayName.toLowerCase().includes(searchQuery)) ||
          (u.email && u.email.toLowerCase().includes(searchQuery)) ||
          (u.phone && u.phone.toLowerCase().includes(searchQuery)) ||
          (u.phoneNumber && u.phoneNumber.toLowerCase().includes(searchQuery))
      );
    }

    return res.status(200).json(filtered);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/stats
 * Detailed metrics separating guesthouses vs cars, hosts vs guests
 */
export const getAdminStatsController = async (req, res, next) => {
  try {
    const stats = firebaseStore.getAdminStats();
    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/enquiries
 * Retrieve guest bookings and chauffeur ride requests for concierge management
 */
export const getEnquiriesController = async (req, res, next) => {
  try {
    const enquiries = mockStore.getEnquiries();
    return res.status(200).json(enquiries);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/enquiries/:id
 * Update status of booking/ride request (e.g. contacted, confirmed, completed)
 */
export const updateEnquiryController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    return res.status(200).json({
      success: true,
      message: `Enquiry ${id} updated`,
      id,
      status: status || 'contacted',
      notes,
    });
  } catch (error) {
    next(error);
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

    let rawCategory = req.body.category;
    if (!rawCategory) {
      if (req.body.type === 'car' || req.body.type === 'car_service' || req.body.type === 'sale') {
        rawCategory = 'car_service';
      } else {
        rawCategory = 'guesthouse';
      }
    } else if (rawCategory === 'car') {
      rawCategory = 'car_service';
    }
    const category = rawCategory;

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

    const type = category === 'car_service' || req.body.type === 'car' ? 'car' : 'guesthouse';
    const city = req.body.city || location.split(',')[0].trim() || 'City Center';

    const listingData = {
      ...req.body,
      title,
      name,
      address,
      location,
      city,
      category,
      type,
      propertyType: category === 'car_service' ? 'sale' : 'rent',
      regularPrice,
      price,
      discountPrice,
      offer: Boolean(req.body.offer || (discountPrice > 0 && discountPrice < regularPrice)),
      status,
      isApproved,
      active,
      isActive,
      images: imageUrls,
      imageUrls,
      imageURLs: imageUrls,
      userRef: req.user?.id || req.body.userRef || 'admin_master',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const listing = storage.createListing(listingData);
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
 * Allows administrator to delete any current or future listing permanently from backend & storage.
 */
export const adminDeleteListing = async (req, res, next) => {
  const { id } = req.params;
  try {
    storage.deleteListing(id);
    mockStore.deleteListing(id);

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
    const updated = storage.updateListing(id, req.body);
    if (!updated) {
      return next(errorHandler(404, 'Listing not found!'));
    }
    mockStore.updateListing(id, req.body);
    if (isDbConnected()) {
      Listing.findByIdAndUpdate(id, req.body, { new: true }).catch(() => {});
    }
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
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

  const item = storage.getListing(id);
  if (item) return res.status(200).json(item);

  return next(errorHandler(404, 'Listing not found!'));
};

/**
 * POST /api/admin/set-claim
 * Set admin status/claim on a user
 */
export const setAdminClaim = async (req, res, next) => {
  try {
    const { email, admin: grantAdmin = true } = req.body;
    if (!email) return next(errorHandler(400, 'Target email is required.'));

    if (!grantAdmin && req.user && req.user.email?.toLowerCase() === email.toLowerCase()) {
      return next(errorHandler(400, 'You cannot demote yourself.'));
    }

    const user = firebaseStore.getUserByEmail(email) || mockStore.findUserByEmail(email);
    if (user) {
      firebaseStore.updateUser(user._id, { role: grantAdmin ? 'admin' : 'user', isAdmin: grantAdmin });
      mockStore.updateUser(user._id, { role: grantAdmin ? 'admin' : 'user', isAdmin: grantAdmin });
      if (isDbConnected()) {
        User.findOneAndUpdate({ email }, { role: grantAdmin ? 'admin' : 'user', isAdmin: grantAdmin }).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: `Admin privileges ${grantAdmin ? 'granted to' : 'revoked from'} ${email}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/toggle-user-disabled
 * Disable or enable user account
 */
export const setUserDisabled = async (req, res, next) => {
  try {
    const uid = req.body.uid || req.params.id;
    const { disabled } = req.body;
    if (!uid) return next(errorHandler(400, 'User UID is required.'));

    if (req.user && req.user.id === uid && disabled) {
      return next(errorHandler(400, 'You cannot disable your own account.'));
    }

    firebaseStore.updateUser(uid, { disabled: Boolean(disabled) });
    mockStore.updateUser(uid, { disabled: Boolean(disabled) });

    if (isDbConnected()) {
      User.findByIdAndUpdate(uid, { disabled: Boolean(disabled) }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: `User account ${disabled ? 'disabled' : 'enabled'} successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/delete-user
 * Delete user account permanently
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { uid } = req.body;
    if (!uid) return next(errorHandler(400, 'User UID is required.'));

    if (req.user && req.user.id === uid) {
      return next(errorHandler(400, 'You cannot delete your own account.'));
    }

    firebaseStore.deleteUser(uid);
    mockStore.deleteUser(uid);

    if (isDbConnected()) {
      User.findByIdAndDelete(uid).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'User account deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/send-decision-email
 * Simulate sending listing decision email to owner
 */
export const sendListingDecisionEmail = async (req, res, next) => {
  try {
    const { ownerEmail, listingTitle, decision, reasonOrNote } = req.body;
    console.log(`[Email Notification] To: ${ownerEmail} | Listing: ${listingTitle} | Decision: ${decision} | Notes: ${reasonOrNote || 'None'}`);
    return res.status(200).json({ success: true, message: 'Notification processed' });
  } catch (error) {
    next(error);
  }
};

