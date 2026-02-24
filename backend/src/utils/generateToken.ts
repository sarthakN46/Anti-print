import jwt from 'jsonwebtoken';
import { Response } from 'express';

const generateToken = (res: Response, userId: string) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET is not defined in .env');
  }

  // Create the token
  const token = jwt.sign({ userId }, secret, {
    expiresIn: '30d', // Session lasts 30 days
  });

  // Option 1: Send as HTTP-Only Cookie (More Secure for Web)
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development', // Use HTTPS in prod
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  
  // Option 2: Also return it in JSON (for Mobile/Postman testing)
  return token;
};

export default generateToken;