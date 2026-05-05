function normalizeCountryTerm(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

function buildSupportedRegionCodes() {
  const supportedCodes = [];

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const displayName = regionDisplayNames.of(code);

      if (displayName && displayName !== code) {
        supportedCodes.push(code);
      }
    }
  }

  return supportedCodes;
}

const supportedRegionCodes = buildSupportedRegionCodes();

const countryNameToCode = new Map(
  supportedRegionCodes.map((code) => [normalizeCountryTerm(regionDisplayNames.of(code)), code]),
);

function buildGeneratedDemonymAliases() {
  const aliases = [];

  for (const code of supportedRegionCodes) {
    const countryName = normalizeCountryTerm(regionDisplayNames.of(code));

    if (countryName.endsWith("a")) {
      aliases.push([`${countryName.slice(0, -1)}an`, code]);
    }

    if (countryName.endsWith("e")) {
      aliases.push([`${countryName}an`, code]);
    }

    if (countryName.endsWith("y")) {
      aliases.push([`${countryName.slice(0, -1)}ian`, code]);
    }

    if (countryName.endsWith("n")) {
      aliases.push([`${countryName}ian`, code]);
    }
  }

  return aliases;
}

const countryAliases = new Map([
  ["uk", "GB"],
  ["u k", "GB"],
  ["great britain", "GB"],
  ["britain", "GB"],
  ["british", "GB"],
  ["usa", "US"],
  ["u s a", "US"],
  ["us", "US"],
  ["u s", "US"],
  ["united states", "US"],
  ["united states of america", "US"],
  ["american", "US"],
  ["ghanaian", "GH"],
  ["nigerian", "NG"],
  ["kenyan", "KE"],
  ["angolan", "AO"],
  ...buildGeneratedDemonymAliases(),
]);

export function getCountryName(countryId) {
  if (typeof countryId !== "string" || countryId.trim() === "") {
    return null;
  }

  const normalizedCode = countryId.trim().toUpperCase();

  if (!supportedRegionCodes.includes(normalizedCode)) {
    return normalizedCode;
  }

  return regionDisplayNames.of(normalizedCode) || normalizedCode;
}

export function lookupCountryCode(countryTerm) {
  if (typeof countryTerm !== "string" || countryTerm.trim() === "") {
    return null;
  }

  const normalizedTerm = normalizeCountryTerm(countryTerm);

  if (countryAliases.has(normalizedTerm)) {
    return countryAliases.get(normalizedTerm);
  }

  if (countryNameToCode.has(normalizedTerm)) {
    return countryNameToCode.get(normalizedTerm);
  }

  const directCode = countryTerm.trim().toUpperCase();

  return supportedRegionCodes.includes(directCode) ? directCode : null;
}