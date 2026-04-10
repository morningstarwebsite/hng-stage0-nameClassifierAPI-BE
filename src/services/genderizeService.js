// Single responsibility: call the Genderize API and return its raw JSON.
// Throws a structured error on network failure or a non-200 response.

const GENDERIZE_URL = "https://api.genderize.io";

/**
 * Fetches gender prediction data for a given name.
 * @param {string} name
 * @returns {Promise<{ name: string, gender: string|null, probability: number, count: number }>}
 */
export async function fetchGenderPrediction(name) {
  const url = `${GENDERIZE_URL}?name=${encodeURIComponent(name)}`;

  let response;

  try {
    response = await fetch(url);
  } catch (networkError) {
    // fetch() itself threw — the upstream host is unreachable
    const err = new Error("Unable to reach the Genderize API");
    err.code = "UPSTREAM_UNREACHABLE";
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`Genderize API returned status ${response.status}`);
    err.code = "UPSTREAM_ERROR";
    err.upstreamStatus = response.status;
    throw err;
  }

  let data;

  try {
    data = await response.json();
  } catch {
    const err = new Error("Genderize API returned an invalid JSON body");
    err.code = "UPSTREAM_INVALID_RESPONSE";
    throw err;
  }

  return data;
}