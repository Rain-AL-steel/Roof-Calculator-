import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const DEFAULT_JWT_EXPIRES_IN = "8h";
export const BCRYPT_ROUNDS = 12;

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function getJwtSecret(options) {
  return compactText(options && options.jwtSecret) || compactText(process.env.JWT_SECRET);
}

export function getJwtExpiresIn(options) {
  return compactText(options && options.jwtExpiresIn) || compactText(process.env.JWT_EXPIRES_IN) || DEFAULT_JWT_EXPIRES_IN;
}

export function getUserRoles(user) {
  return (Array.isArray(user && user.roles) ? user.roles : []).map(function (userRole) {
    return compactText(userRole && userRole.role && userRole.role.code);
  }).filter(Boolean);
}

export function toAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || "",
    roles: getUserRoles(user)
  };
}

export function signAuthToken(user, secret, expiresIn) {
  return jwt.sign({
    sub: user.id,
    username: user.username,
    roles: getUserRoles(user)
  }, secret, {
    expiresIn: expiresIn || DEFAULT_JWT_EXPIRES_IN
  });
}

export function verifyAuthToken(token, secret) {
  return jwt.verify(token, secret);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(String(password || ""), passwordHash);
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);
}

export async function findUserForLogin(prisma, username) {
  return prisma.user.findUnique({
    where: { username: username },
    include: {
      roles: {
        include: { role: true }
      }
    }
  });
}
