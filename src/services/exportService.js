import { AppError } from "../utils/appError.js";
import { exportProfileRecords } from "./profileService.js";

const csvColumns = [
  "id",
  "name",
  "gender",
  "gender_probability",
  "age",
  "age_group",
  "country_id",
  "country_name",
  "country_probability",
  "created_at",
];

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function serializeProfilesToCsv(profiles) {
  const lines = [csvColumns.join(",")];

  for (const profile of profiles) {
    lines.push(csvColumns.map((column) => escapeCsvValue(profile[column])).join(","));
  }

  return lines.join("\n");
}

export async function exportProfiles(filters, format) {
  if (format !== "csv") {
    throw new AppError(400, "Unsupported export format");
  }

  const profiles = await exportProfileRecords(filters);

  return serializeProfilesToCsv(profiles);
}
