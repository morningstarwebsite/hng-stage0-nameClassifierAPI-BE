// Validates the incoming request, delegates to the service layer,
// transforms the upstream data, and sends back a strict JSON response.

import { fetchGenderPrediction } from "../services/genderizeService.js";

/**
 * GET /api/classify?name={name}
 */
export async function classifyName(req, res) {
  const { name } = req.query;

  // --- Input validation ---

  // 422: name param exists but is not a string (e.g. ?name[]=foo)
  if (name !== undefined && typeof name !== "string") {
    return res.status(422).json({
      status: "error",
      message: "The 'name' parameter must be a plain string",
    });
  }

  // 400: name is missing or empty after trimming
  if (!name || name.trim() === "") {
    return res.status(400).json({
      status: "error",
      message: "The 'name' query parameter is required and cannot be empty",
    });
  }

  const trimmedName = name.trim();

  // --- Upstream call ---

  let raw;

  try {
    raw = await fetchGenderPrediction(trimmedName);
  } catch (err) {
    if (err.code === "UPSTREAM_UNREACHABLE") {
      return res.status(502).json({
        status: "error",
        message: "Could not connect to the upstream gender prediction service",
      });
    }

    if (err.code === "UPSTREAM_ERROR") {
      return res.status(502).json({
        status: "error",
        message: `Upstream service error (HTTP ${err.upstreamStatus})`,
      });
    }

    if (err.code === "UPSTREAM_INVALID_RESPONSE") {
      return res.status(502).json({
        status: "error",
        message: "Upstream service returned an invalid response",
      });
    }

    // Catch-all for unexpected server errors
    console.error("[classify] Unexpected error:", err);
    return res.status(500).json({
      status: "error",
      message: "An unexpected server error occurred",
    });
  }

  // --- Handle unpredictable names ---
  // Genderize returns gender: null or count: 0 when it has no data for a name
  if (!raw.gender || raw.count === 0) {
    return res.status(404).json({
      status: "error",
      message: "No prediction available for the provided name",
    });
  }

  // --- Shape and return the response ---
  const sample_size = raw.count;
  const probability = raw.probability;

  return res.status(200).json({
    name: raw.name,
    gender: raw.gender,
    probability,
    sample_size,
    is_confident: probability >= 0.7 && sample_size >= 100,
    processed_at: new Date().toISOString(), // fresh UTC ISO 8601 on every request
  });
}