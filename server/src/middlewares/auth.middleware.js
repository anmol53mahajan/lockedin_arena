const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

function getCookieToken(req) {
  if (req.cookies) {
    return req.cookies.token || req.cookies.jwt || null;
  }

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    if (name === 'token' || name === 'jwt') {
      try {
        return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function protect(req, res, next) {
  const authorization = req.get('authorization');
  const bearerMatch = authorization && authorization.match(/^Bearer\s+(.+)$/i);
  const token = (bearerMatch && bearerMatch[1].trim()) || getCookieToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error('JWT_SECRET is not configured'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || typeof decoded.id !== 'string' || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await User.findById(decoded.id).select(
      '-password -verificationToken -verificationTokenExpiresAt'
    );
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    return next(error);
  }
}

module.exports = { protect };
