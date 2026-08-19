import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

const isProduction = process.env.NODE_ENV === 'production';

export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const requireAuth = async (req: any, res: any, next: any) => {
  let token = null;

  if (req.cookies?.token) {
    token = req.cookies.token;
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
  res.cookie('token', token, authCookieOptions);
};

export const clearAuthCookie = (res: any) => {
  const { maxAge: _maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie('token', clearOptions);
};
