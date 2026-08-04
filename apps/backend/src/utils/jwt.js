import jwt from 'jsonwebtoken';

export function generateToken(userId, expiresIn = '30d') {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
