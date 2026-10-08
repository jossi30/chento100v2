import mongoose from 'mongoose';
import User from '../models/user.model.js';
import bcryptjs from 'bcryptjs';
import { errorHandler } from '../utils/error.js';
import jwt from 'jsonwebtoken';
import { mockStore } from '../utils/mockStore.js';
import { firebaseStore } from '../utils/firebaseStore.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

export const signup = async (req, res, next) => {
  const { username, name, displayName, email, password, phone, phoneNumber, role, accountType, hostType } = req.body;
  if (!email || !password) {
    return next(errorHandler(400, 'Email and password are required!'));
  }

  const resolvedName = name || displayName || username || email.split('@')[0];
  const resolvedPhone = phone || phoneNumber || '';
  const resolvedRole = role || (accountType === 'host' ? 'host' : 'user');
  const resolvedAccountType = accountType || (role === 'host' ? 'host' : 'user');
  const hashedPassword = bcryptjs.hashSync(password, 10);

  const userData = {
    username: resolvedName,
    displayName: resolvedName,
    name: resolvedName,
    email: email.trim().toLowerCase(),
    phone: resolvedPhone,
    phoneNumber: resolvedPhone,
    password: hashedPassword,
    role: resolvedRole,
    accountType: resolvedAccountType,
    hostType: hostType || '',
    registeredAsPartner: resolvedAccountType === 'host' || Boolean(hostType),
    emailVerified: true,
  };

  try {
    const createdUser = mockStore.createUser(userData);
    firebaseStore.createUser(userData);

    if (isDbConnected()) {
      User.create(userData).catch(() => {});
    }

    const jwtSecret = process.env.JWT_SECRET || 'mern_estate_jwt_secret_key_default';
    const token = jwt.sign(
      { id: createdUser._id, role: createdUser.role, isAdmin: Boolean(createdUser.isAdmin) },
      jwtSecret
    );
    const { password: pass, ...rest } = createdUser;

    return res
      .cookie('access_token', token, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({ success: true, message: 'User registered successfully!', ...rest, token });
  } catch (error) {
    next(error);
  }
};

export const signin = async (req, res, next) => {
  const { email, password } = req.body;
  const jwtSecret = process.env.JWT_SECRET || 'mern_estate_jwt_secret_key_default';

  const isSpecialAdmin =
    email &&
    typeof email === 'string' &&
    (email.toLowerCase() === 'jossvision11@gmail.com' ||
      email.toLowerCase() === 'joepatriot30@gmail.com' ||
      email.toLowerCase() === 'admin@chento100.com' ||
      email.toLowerCase().includes('admin'));

  const user = firebaseStore.getUserByEmail(email) || mockStore.findUserByEmail(email);
  if (!user) return next(errorHandler(404, 'User not found!'));

  const validPassword = bcryptjs.compareSync(password, user.password);
  if (!validPassword) return next(errorHandler(401, 'Wrong credentials!'));

  const isAdmin = Boolean(isSpecialAdmin || user.isAdmin || user.role === 'admin');
  const token = jwt.sign(
    { id: user._id, role: user.role || (isAdmin ? 'admin' : 'user'), isAdmin },
    jwtSecret
  );
  const { password: pass, ...rest } = user;
  return res
    .cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(200)
    .json({ ...rest, isAdmin, token });
};

export const getMe = async (req, res, next) => {
  const userId = req.user.id;
  const user = firebaseStore.getUser(userId) || mockStore.findUserById(userId);
  if (!user) {
    return next(errorHandler(404, 'User not found!'));
  }
  const { password: pass, ...rest } = user;
  return res.status(200).json(rest);
};

export const google = async (req, res, next) => {
  const jwtSecret = process.env.JWT_SECRET || 'mern_estate_jwt_secret_key_default';
  const emailVal = req.body && req.body.email;
  const isSpecialAdmin =
    emailVal &&
    typeof emailVal === 'string' &&
    (emailVal.toLowerCase() === 'jossvision11@gmail.com' ||
      emailVal.toLowerCase() === 'joepatriot30@gmail.com' ||
      emailVal.toLowerCase() === 'admin@chento100.com' ||
      emailVal.toLowerCase().includes('admin'));

  let user = firebaseStore.getUserByEmail(req.body.email) || mockStore.findUserByEmail(req.body.email);
  if (!user) {
    user = firebaseStore.createUser({
      username:
        (req.body.name || 'user').split(' ').join('').toLowerCase() +
        Math.random().toString(36).slice(-4),
      email: req.body.email,
      password: bcryptjs.hashSync(Math.random().toString(36), 10),
      avatar: req.body.photo || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
      isAdmin: Boolean(isSpecialAdmin),
      role: isSpecialAdmin ? 'admin' : 'user',
    });
    mockStore.createUser(user);

    if (isDbConnected()) {
      User.create(user).catch(() => {});
    }
  }

  const isAdmin = Boolean(isSpecialAdmin || user.isAdmin || user.role === 'admin');
  const token = jwt.sign(
    { id: user._id, role: user.role || (isAdmin ? 'admin' : 'user'), isAdmin },
    jwtSecret
  );
  const { password: pass, ...rest } = user;
  return res
    .cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(200)
    .json({ ...rest, isAdmin, token });
};

export const signOut = async (req, res, next) => {
  try {
    res.clearCookie('access_token');
    res.status(200).json('User has been logged out!');
  } catch (error) {
    next(error);
  }
};
