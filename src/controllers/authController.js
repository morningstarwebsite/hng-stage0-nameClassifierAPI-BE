import {
  clearOauthCookies,
  clearSessionCookies,
  readOauthCookies,
  setOauthCookies,
  setSessionCookies,
  getRefreshCookieName,
} from "../services/authCookieService.js";
import {
  completeGithubAuthentication,
  createGithubAuthorizationRequest,
  logoutAuthentication,
  refreshAuthentication,
} from "../services/authService.js";

function buildRequestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  };
}

export function beginGithubAuth(_req, res) {
  const oauthRequest = createGithubAuthorizationRequest();

  setOauthCookies(res, oauthRequest.state, oauthRequest.codeVerifier);
  res.redirect(oauthRequest.url);
}

export async function githubAuthCallback(req, res, next) {
  try {
    const oauthCookies = readOauthCookies(req);
    const session = await completeGithubAuthentication({
      code: req.query.code,
      state: req.query.state,
      storedState: oauthCookies.state,
      codeVerifier: oauthCookies.codeVerifier,
      context: buildRequestContext(req),
    });

    clearOauthCookies(res);
    setSessionCookies(res, session);
    res.status(200).json({
      status: "success",
      data: {
        access_token: session.accessToken,
        access_token_expires_at: session.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: session.refreshTokenExpiresAt.toISOString(),
        csrf_token: session.csrfToken,
        user: session.user,
      },
    });
  } catch (error) {
    clearOauthCookies(res);
    next(error);
  }
}

export async function refreshSession(req, res, next) {
  try {
    const refreshToken = req.cookies?.[getRefreshCookieName()];
    const session = await refreshAuthentication(refreshToken, buildRequestContext(req));

    setSessionCookies(res, session);
    res.status(200).json({
      status: "success",
      data: {
        access_token: session.accessToken,
        access_token_expires_at: session.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: session.refreshTokenExpiresAt.toISOString(),
        csrf_token: session.csrfToken,
        user: session.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutSession(req, res, next) {
  try {
    const refreshToken = req.cookies?.[getRefreshCookieName()];

    await logoutAuthentication(refreshToken);
    clearSessionCookies(res);
    clearOauthCookies(res);
    res.status(200).json({
      status: "success",
      message: "Logged out",
    });
  } catch (error) {
    next(error);
  }
}
