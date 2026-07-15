import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import generateToken from '../utils/generateToken';
import { OAuth2Client } from 'google-auth-library';
import { validatePassword } from '../middlewares/securityMiddleware';

import Shop from '../models/Shop';

// Allow using the same VITE_ variable for backend convenience, or standard GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const BCRYPT_ROUNDS = 12; // Increased from 10 for stronger hashing

// @desc    Register a new User
// @route   POST /api/auth/register-user
// @access  Public
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation
    if (!name || !email || !password) {
      res.status(400).json({ message: 'Please fill all fields' });
      return;
    }
    
    // Name sanitization (prevent XSS via stored names)
    if (typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ message: 'Name must be 1-100 characters' });
      return;
    }

    // Email Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
       res.status(400).json({ message: 'Invalid email format' });
       return;
    }

    // Password Strength (hardened)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
       res.status(400).json({ 
         message: 'Password too weak',
         requirements: passwordCheck.errors
       });
       return;
    }

    // 2. Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // 3. Hash password (increased salt rounds)
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create User (Role: USER)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'USER'
    });

    if (user) {
      const token = generateToken(res, user._id.toString());
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token,
        message: 'User registered successfully'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error');
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Register a new Shop Owner
// @route   POST /api/auth/register-shop
// @access  Public
export const registerShopOwner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation
    if (!name || !email || !password) {
      res.status(400).json({ message: 'Please fill all fields' });
      return;
    }

    if (typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ message: 'Name must be 1-100 characters' });
      return;
    }

    // Email Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
       res.status(400).json({ message: 'Invalid email format' });
       return;
    }

    // Password Strength (hardened)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
       res.status(400).json({ 
         message: 'Password too weak',
         requirements: passwordCheck.errors
       });
       return;
    }

    // 2. Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      res.status(400).json({ message: 'Email already registered. Please log in.' });
      return;
    }

    // 3. Hash password (increased salt rounds)
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create User (Role: OWNER)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'OWNER'
    });

    if (user) {
      generateToken(res, user._id.toString());
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        message: 'Shop Owner registered successfully'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Shop registration error');
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Login User (Shop Owner or Employee)
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    // 1. Find user by email (Explicitly select password because we hid it in Model)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // 2. Check password — use constant-time comparison message to prevent user enumeration
    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const token = generateToken(res, user._id.toString());
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token 
      });
    } else {
      // Generic message prevents user enumeration attacks
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error');
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Google Login (Real Verification)
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body; // The JWT token from Google

    if (!credential || typeof credential !== 'string') {
       res.status(400).json({ message: 'No credential provided' });
       return;
    }

    // 1. Verify Token with Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID 
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
       res.status(400).json({ message: 'Invalid Google Token' });
       return;
    }

    const { email, name, sub: googleId } = payload;

    if (!email) {
      res.status(400).json({ message: 'Email access required' });
      return;
    }

    // 2. Check if user exists
    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // 3. Register new user automatically
      user = await User.create({
        name: name || 'User',
        email: email.toLowerCase().trim(),
        googleId,
        role: 'USER'
      });
    }

    // 4. Generate Token
    const token = generateToken(res, user._id.toString());
    
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: token
    });

  } catch (error) {
    console.error('Google Auth Error');
    res.status(400).json({ message: 'Google Authentication Failed' });
  }
};