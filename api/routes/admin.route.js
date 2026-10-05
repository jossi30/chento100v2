import express from 'express';
import { verifyToken, verifyAdmin } from '../utils/verifyUser.js';
import {
  getAdminListings,
  getAllListings,
  getPendingListings,
  approveListing,
  rejectListing,
  toggleStatusListing,
  toggleActiveListing,
  getUsers,
  adminCreateListing,
  adminDeleteListing,
  adminUpdateListing,
  adminGetListing,
  setAdminClaim,
  setUserDisabled,
  deleteUser,
  sendListingDecisionEmail,
} from '../controllers/admin.controller.js';

const router = express.Router();

// 1. GET /api/admin/listings (fetch listings filtered by isApproved: false or all listings)
router.get('/listings', getAdminListings);
router.get('/listings/all', getAllListings);
router.get('/listings/pending', getPendingListings);

// 2. Specific action subpaths on listings
router.patch('/listings/:id/approve', verifyToken, verifyAdmin, approveListing);
router.put('/listings/:id/approve', verifyToken, verifyAdmin, approveListing);
router.patch('/listings/:id/reject', verifyToken, verifyAdmin, rejectListing);
router.put('/listings/:id/reject', verifyToken, verifyAdmin, rejectListing);
router.patch('/listings/:id/toggle-active', verifyToken, verifyAdmin, toggleActiveListing);
router.put('/listings/:id/toggle-active', verifyToken, verifyAdmin, toggleActiveListing);
router.put('/listings/:id/toggle-status', verifyToken, verifyAdmin, toggleStatusListing);
router.patch('/listings/:id/toggle-status', verifyToken, verifyAdmin, toggleStatusListing);

// 3. User & Admin Management
router.post('/set-claim', verifyToken, verifyAdmin, setAdminClaim);
router.post('/toggle-user-disabled', verifyToken, verifyAdmin, setUserDisabled);
router.post('/delete-user', verifyToken, verifyAdmin, deleteUser);
router.post('/send-decision-email', verifyToken, verifyAdmin, sendListingDecisionEmail);

// 4. Admin Create, Edit & Delete operations on any listing
router.post('/listings', verifyToken, verifyAdmin, adminCreateListing);
router.post('/create', verifyToken, verifyAdmin, adminCreateListing);
router.delete('/listings/:id', verifyToken, verifyAdmin, adminDeleteListing);
router.delete('/delete/:id', verifyToken, verifyAdmin, adminDeleteListing);
router.put('/listings/:id', verifyToken, verifyAdmin, adminUpdateListing);
router.post('/listings/:id', verifyToken, verifyAdmin, adminUpdateListing);
router.put('/update/:id', verifyToken, verifyAdmin, adminUpdateListing);
router.post('/update/:id', verifyToken, verifyAdmin, adminUpdateListing);
router.get('/listings/:id', adminGetListing);

// --- Backwards compatibility routes for existing frontend & admin dashboard ---
router.put('/approve/:id', verifyToken, verifyAdmin, approveListing);
router.patch('/approve/:id', verifyToken, verifyAdmin, approveListing);
router.put('/toggle-status/:id', verifyToken, verifyAdmin, toggleStatusListing);
router.patch('/toggle-status/:id', verifyToken, verifyAdmin, toggleStatusListing);
router.put('/toggle-active/:id', verifyToken, verifyAdmin, toggleStatusListing);
router.patch('/toggle-active/:id', verifyToken, verifyAdmin, toggleStatusListing);

router.get('/users', verifyToken, verifyAdmin, getUsers);

export default router;
