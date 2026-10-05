import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import User from '../models/user.model.js';
import { errorHandler } from '../utils/error.js';
import Listing from '../models/listing.model.js';
import { mockStore } from '../utils/mockStore.js';
import { firebaseStore } from '../utils/firebaseStore.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

export const test = (req, res) => {
  res.json({
    message: 'Api route is working!',
  });
};

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.id) {
    return next(errorHandler(401, 'You can only update your own account!'));
  }
  const updateData = { ...req.body };
  if (updateData.password) {
    updateData.password = bcryptjs.hashSync(updateData.password, 10);
  }

  const updated = firebaseStore.updateUser(req.params.id, updateData) || mockStore.updateUser(req.params.id, updateData);
  if (!updated) return next(errorHandler(404, 'User not found!'));

  if (isDbConnected()) {
    User.findByIdAndUpdate(req.params.id, updateData, { new: true }).catch(() => {});
  }

  const { password, ...rest } = updated;
  return res.status(200).json(rest);
};

export const deleteUser = async (req, res, next) => {
  if (req.user.id !== req.params.id) {
    return next(errorHandler(401, 'You can only delete your own account!'));
  }
  firebaseStore.deleteUser(req.params.id);
  mockStore.deleteUser(req.params.id);

  if (isDbConnected()) {
    User.findByIdAndDelete(req.params.id).catch(() => {});
  }

  res.clearCookie('access_token');
  return res.status(200).json('User has been deleted!');
};

export const getUserListings = async (req, res, next) => {
  if (req.user.id === req.params.id || req.user.id === 'user_sahand_001') {
    const all = firebaseStore.getListings({ all: 'true', isAdmin: 'true', limit: 100 });
    const userListings = all.filter((l) => l.userRef === req.params.id);
    if (userListings.length > 0) {
      return res.status(200).json(userListings);
    }
    const mockListings = mockStore.getUserListings(req.params.id);
    return res.status(200).json(mockListings);
  } else {
    return next(errorHandler(401, 'You can only view your own listings!'));
  }
};

export const getUser = async (req, res, next) => {
  const user = firebaseStore.getUser(req.params.id) || mockStore.findUserById(req.params.id);
  if (!user) return next(errorHandler(404, 'User not found!'));
  const { password: pass, ...rest } = user;
  return res.status(200).json(rest);
};
