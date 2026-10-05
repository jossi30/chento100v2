import express from 'express';
import { google, signOut, signin, signup, getMe } from '../controllers/auth.controller.js';
import { verifyToken } from '../utils/verifyUser.js';

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.post('/google', google);
router.get('/signout', signOut);
router.get('/me', verifyToken, getMe);

export default router;