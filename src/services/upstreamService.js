import { AppError } from "../utils/appError.js";

const GENDERIZE_URL = "https://api.genderize.io";
const AGIFY_URL = "https://api.agify.io";
const NATIONALIZE_URL = "https://api.nationalize.io";

async function fetchUpstreamJson(url, serviceName) {
  let response;

  try {
    response = await fetch(url);
  } catch {
    throw new AppError(502, `Could not connect to the ${serviceName} service`);
  }

  if (!response.ok) {
    throw new AppError(502, `${serviceName} service returned HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new AppError(502, `${serviceName} service returned invalid JSON`);
  }
}

export function fetchGenderPrediction(name) {
  const url = `${GENDERIZE_URL}?name=${encodeURIComponent(name)}`;
  return fetchUpstreamJson(url, "Genderize");
}

export function fetchAgePrediction(name) {
  const url = `${AGIFY_URL}?name=${encodeURIComponent(name)}`;
  return fetchUpstreamJson(url, "Agify");
}

export function fetchNationalityPrediction(name) {
  const url = `${NATIONALIZE_URL}?name=${encodeURIComponent(name)}`;
  return fetchUpstreamJson(url, "Nationalize");
}