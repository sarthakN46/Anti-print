import jwt from 'jsonwebtoken';
import { Response } from 'express';

const generateToken = (res: Response, userId: string) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET is not defined in .env');
  }

  // Create the token with issuer/audience claims
  const token = jwt.sign(
    { userId },
    secret,
    {
      expiresIn: '7d',             // Reduced from 30d for security
      issuer: 'xerox-saas',        // Token origin verification
      audience: 'xerox-app',       // Intended recipient
    }
  );

  // HTTP-Only Cookie (More Secure for Web)
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',               // Changed from 'strict' to support OAuth redirects
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiry)
  });
  
  // Also return it in JSON (for Mobile/Postman testing)
  return token;
};

export default generateToken;