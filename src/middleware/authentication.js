import { User } from "../models/index.js";
import { getAccessCookieName } from "../services/authCookieService.js";
import { verifyAccessToken } from "../services/tokenService.js";
import { AppError } from "../utils/appError.js";

function readBearerToken(req) {
  const authorization = req.get("Authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Invalid authorization header");
  }

  return token;
}

export async function authenticateRequest(req, _res, next) {
  try {
    const bearerToken = readBearerToken(req);
    const cookieToken = req.cookies?.[getAccessCookieName()];
    const accessToken = bearerToken || cookieToken;

    if (!accessToken) {
      throw new AppError(401, "Authentication required");
    }

    const payload = verifyAccessToken(accessToken);
    const user = await User.findByPk(payload.sub);

    if (!user) {
      throw new AppError(401, "Authentication required");
    }

    if (!user.is_active) {
      throw new AppError(403, "User account is inactive");
    }

    req.user = {
      id: user.id,
      role: user.role,
      username: user.username,
      is_active: user.is_active,
    };
    req.auth = {
      usedCookieAuth: Boolean(cookieToken && !bearerToken),
    };

    next();
  } catch (error) {
    next(error);
  }
}
