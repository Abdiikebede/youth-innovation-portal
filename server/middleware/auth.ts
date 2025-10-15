import { RequestHandler } from "express";
import jwt from "jsonwebtoken";

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = decoded as JWTPayload;
    next();
  });
};

export const optionalAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', (err, decoded) => {
      if (!err) {
        (req as any).user = decoded as JWTPayload;
      }
    });
  }

  next();
};
