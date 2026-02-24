import express from 'express';
import { registerShopOwner, loginUser, registerUser, googleLogin } from '../controllers/authController';

const router = express.Router();

router.post('/register-shop', registerShopOwner);
router.post('/register-user', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);

export default router;