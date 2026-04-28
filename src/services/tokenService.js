import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { RefreshToken, User } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { requireEnv } from "../utils/env.js";

const ACCESS_TOKEN_TTL_SECONDS = 3 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 5 * 60;

function now() {
  return new Date();
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function getAccessTokenTtlSeconds() {
  return ACCESS_TOKEN_TTL_SECONDS;
}

export function getRefreshTokenTtlSeconds() {
  return REFRESH_TOKEN_TTL_SECONDS;
}

export function signAccessToken(user) {
  const secret = requireEnv("ACCESS_TOKEN_SECRET");

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      issuer: "insighta-labs-plus",
      audience: "insighta-api",
    },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, requireEnv("ACCESS_TOKEN_SECRET"), {
      algorithms: ["HS256"],
      issuer: "insighta-labs-plus",
      audience: "insighta-api",
    });
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
}

export async function issueRefreshToken(user, context = {}) {
  const rawToken = generateOpaqueToken();
  const issuedAt = now();
  const refreshToken = await RefreshToken.create({
    user_id: user.id,
    token_hash: hashToken(rawToken),
    expires_at: addSeconds(issuedAt, REFRESH_TOKEN_TTL_SECONDS),
    user_agent: context.userAgent,
    ip_address: context.ipAddress,
  });

  return {
    rawToken,
    record: refreshToken,
    expiresAt: refreshToken.expires_at,
  };
}

async function loadUsableRefreshToken(rawToken) {
  const tokenRecord = await RefreshToken.findOne({
    where: {
      token_hash: hashToken(rawToken),
    },
    include: [{ model: User, as: "user" }],
  });

  if (!tokenRecord || tokenRecord.revoked_at) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
    await tokenRecord.update({ revoked_at: now() });
    throw new AppError(401, "Refresh token expired");
  }

  if (!tokenRecord.user) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (!tokenRecord.user.is_active) {
    throw new AppError(403, "User account is inactive");
  }

  return tokenRecord;
}

export async function rotateRefreshToken(rawToken, context = {}) {
  const currentToken = await loadUsableRefreshToken(rawToken);
  const replacement = await issueRefreshToken(currentToken.user, context);

  await currentToken.update({
    revoked_at: now(),
    replaced_by_token_id: replacement.record.id,
  });

  return {
    user: currentToken.user,
    rawToken: replacement.rawToken,
    expiresAt: replacement.expiresAt,
  };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) {
    return;
  }

  const tokenRecord = await RefreshToken.findOne({
    where: {
      token_hash: hashToken(rawToken),
    },
  });

  if (!tokenRecord || tokenRecord.revoked_at) {
    return;
  }

  await tokenRecord.update({ revoked_at: now() });
}

export function buildAccessTokenResponse(user) {
  const accessToken = signAccessToken(user);
  const expiresAt = addSeconds(now(), ACCESS_TOKEN_TTL_SECONDS);

  return {
    accessToken,
    expiresAt,
  };
}
