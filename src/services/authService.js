import crypto from "node:crypto";
import { User } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { requireEnv } from "../utils/env.js";
import { buildAccessTokenResponse, issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "./tokenService.js";
import { issueCsrfToken } from "./authCookieService.js";

function buildPkceChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateRandomValue() {
  return crypto.randomBytes(32).toString("base64url");
}

function readStringValue(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function buildAuthUserPayload(user) {
  return {
    id: user.id,
    github_id: user.github_id,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at instanceof Date ? user.last_login_at.toISOString() : user.last_login_at,
    created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at,
  };
}

async function exchangeCodeForAccessToken(code, codeVerifier) {
  const payload = new URLSearchParams({
    client_id: requireEnv("GITHUB_CLIENT_ID"),
    redirect_uri: requireEnv("GITHUB_REDIRECT_URI"),
    code,
    code_verifier: codeVerifier,
  });
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (clientSecret) {
    payload.set("client_secret", clientSecret);
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new AppError(502, "GitHub token exchange failed");
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new AppError(502, "GitHub token exchange failed");
  }

  return data.access_token;
}

async function fetchGithubProfile(accessToken) {
  const [userResponse, emailResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "insighta-labs-plus",
      },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "insighta-labs-plus",
      },
    }),
  ]);

  if (!userResponse.ok) {
    throw new AppError(502, "GitHub user lookup failed");
  }

  const user = await userResponse.json();
  const emails = emailResponse.ok ? await emailResponse.json() : [];
  const primaryEmail = Array.isArray(emails)
    ? emails.find((entry) => entry.primary)?.email || emails.find((entry) => entry.verified)?.email
    : undefined;

  return {
    githubId: String(user.id),
    username: user.login,
    email: primaryEmail || user.email || null,
    avatarUrl: user.avatar_url || null,
  };
}

async function upsertGithubUser(profile) {
  const existingUser = await User.findOne({
    where: {
      github_id: profile.githubId,
    },
  });

  if (existingUser) {
    await existingUser.update({
      username: profile.username,
      email: profile.email,
      avatar_url: profile.avatarUrl,
      last_login_at: new Date(),
    });

    return existingUser;
  }

  return User.create({
    github_id: profile.githubId,
    username: profile.username,
    email: profile.email,
    avatar_url: profile.avatarUrl,
    role: "analyst",
    is_active: true,
    last_login_at: new Date(),
  });
}

async function buildSession(user, context) {
  if (!user.is_active) {
    throw new AppError(403, "User account is inactive");
  }

  const access = buildAccessTokenResponse(user);
  const refresh = await issueRefreshToken(user, context);

  return {
    accessToken: access.accessToken,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.rawToken,
    refreshTokenExpiresAt: refresh.expiresAt,
    csrfToken: issueCsrfToken(),
    user: buildAuthUserPayload(user),
  };
}

function buildAccessSession(user) {
  if (!user.is_active) {
    throw new AppError(403, "User account is inactive");
  }

  const access = buildAccessTokenResponse(user);

  return {
    accessToken: access.accessToken,
    accessTokenExpiresAt: access.expiresAt,
    csrfToken: issueCsrfToken(),
    user: buildAuthUserPayload(user),
  };
}

export function createGithubAuthorizationRequest() {
  const state = generateRandomValue();
  const codeVerifier = generateRandomValue();
  const authUrl = new URL("https://github.com/login/oauth/authorize");

  authUrl.searchParams.set("client_id", requireEnv("GITHUB_CLIENT_ID"));
  authUrl.searchParams.set("redirect_uri", requireEnv("GITHUB_REDIRECT_URI"));
  authUrl.searchParams.set("scope", "read:user user:email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", buildPkceChallenge(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");

  return {
    url: authUrl.toString(),
    state,
    codeVerifier,
  };
}

export async function completeGithubAuthentication({ code, state, storedState, codeVerifier, context }) {
  const normalizedCode = readStringValue(code);
  const normalizedState = readStringValue(state);

  if (!normalizedCode || !normalizedState) {
    throw new AppError(400, "Missing OAuth callback parameters");
  }

  if (!storedState || !codeVerifier || storedState !== normalizedState) {
    throw new AppError(400, "Invalid OAuth state");
  }

  const githubAccessToken = await exchangeCodeForAccessToken(normalizedCode, codeVerifier);
  const githubProfile = await fetchGithubProfile(githubAccessToken);
  const user = await upsertGithubUser(githubProfile);

  return buildSession(user, context);
}

export async function refreshAuthentication(rawRefreshToken, context) {
  if (!rawRefreshToken) {
    throw new AppError(401, "Refresh token required");
  }

  const rotated = await rotateRefreshToken(rawRefreshToken, context);

  return {
    ...buildAccessSession(rotated.user),
    refreshToken: rotated.rawToken,
    refreshTokenExpiresAt: rotated.expiresAt,
  };
}

export async function logoutAuthentication(rawRefreshToken) {
  await revokeRefreshToken(rawRefreshToken);
}
