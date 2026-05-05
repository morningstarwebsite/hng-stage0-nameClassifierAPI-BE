import { connectDatabase, sequelize } from "../config/database.js";
import { importProfilesFromCsv } from "../services/profileCsvImportService.js";

const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error("[csv-import] usage: npm run import:profiles:csv -- ./path/to/profiles.csv");
  process.exit(1);
}

connectDatabase()
  .then(() => importProfilesFromCsv(csvFilePath))
  .then(async (summary) => {
    console.log(JSON.stringify(summary, null, 2));
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error("[csv-import] failed", error);
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  });