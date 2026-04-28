import test from "node:test";
import assert from "node:assert/strict";
import { requireApiVersion } from "../src/middleware/apiVersion.js";
import { createRateLimiter } from "../src/middleware/rateLimiter.js";
import { buildPaginatedPayload } from "../src/services/paginationService.js";
import { serializeProfilesToCsv } from "../src/services/exportService.js";
import { userHasAnyRole } from "../src/services/authorizationService.js";

function createMockResponse() {
  return {
    statusCode: 200,
  };
}

test("requireApiVersion rejects requests without the version header", () => {
  const req = {
    get() {
      return undefined;
    },
  };
  const res = createMockResponse();
  let capturedError;

  requireApiVersion(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.message, "API version header required");
});

test("buildPaginatedPayload adds total_pages and navigation links", () => {
  const req = {
    protocol: "https",
    originalUrl: "/api/profiles?gender=female&page=2&limit=5",
    get(headerName) {
      return headerName === "host" ? "api.example.com" : undefined;
    },
  };

  const payload = buildPaginatedPayload(req, {
    page: 2,
    limit: 5,
    total: 12,
    data: [{ id: "123" }],
  });

  assert.equal(payload.total_pages, 3);
  assert.equal(payload.links.self, "https://api.example.com/api/profiles?gender=female&page=2&limit=5");
  assert.equal(payload.links.next, "https://api.example.com/api/profiles?gender=female&page=3&limit=5");
  assert.equal(payload.links.prev, "https://api.example.com/api/profiles?gender=female&page=1&limit=5");
});

test("serializeProfilesToCsv preserves the required column order", () => {
  const csv = serializeProfilesToCsv([
    {
      id: "1",
      name: "Amina",
      gender: "female",
      gender_probability: 0.99,
      age: 31,
      age_group: "adult",
      country_id: "NG",
      country_name: "Nigeria",
      country_probability: 0.81,
      created_at: "2026-04-16T12:00:00.000Z",
    },
  ]);

  assert.equal(
    csv,
    [
      "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at",
      "1,Amina,female,0.99,31,adult,NG,Nigeria,0.81,2026-04-16T12:00:00.000Z",
    ].join("\n"),
  );
});

test("createRateLimiter rejects requests after the configured threshold", () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 2,
    keyGenerator: (req) => req.user.id,
  });
  const req = { user: { id: "user-1" } };
  const res = createMockResponse();
  let capturedError;

  limiter(req, res, (error) => {
    capturedError = error;
  });
  limiter(req, res, (error) => {
    capturedError = error;
  });
  limiter(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError.statusCode, 429);
  assert.equal(capturedError.message, "Rate limit exceeded");
});

test("userHasAnyRole centralizes role checks", () => {
  assert.equal(userHasAnyRole({ role: "admin" }, ["admin"]), true);
  assert.equal(userHasAnyRole({ role: "analyst" }, ["admin"]), false);
});
