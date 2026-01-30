import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// Extend the Request interface so TypeScript knows 'req.user' exists
export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  // 1. Check if the header has "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

      // Get user from the token (exclude password)
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
         res.status(401).json({ message: 'Not authorized, user not found' });
         return;
      }

      // Attach user to the request object so the Controller can use it
      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware to restrict access to specific roles (e.g. only OWNER)
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: `User role ${req.user?.role} is not authorized to access this route` });
      return;
    }
    next();
  };
};