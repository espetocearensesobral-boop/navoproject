import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

export const requireAuth = async (req: any, res: any, next: any) => {
  let token = null;
  
  if (req.cookies?.token) {
    token = req.cookies.token;
  }
  else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Sessão expirada. Faça login novamente.' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      error: 'Sessão expirada. Faça login novamente.' 
    });
  }
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito apenas para administradores' });
  }
  next();
};

export const optionalAuth = (req: any, res: any, next: any) => {
  let token = null;
  if (req.cookies?.token) {
    token = req.cookies.token;
  }
  else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      req.user = { id: 'usr_guest', role: 'guest' };
    }
  } else {
    req.user = { id: 'usr_guest', role: 'guest' };
  }
  next();
};

export const setAuthCookie = (res: any, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};
