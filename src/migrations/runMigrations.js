import { Sequelize } from "sequelize";
import { sequelize } from "../config/database.js";
import { migration as createProfilesMigration } from "./20260416-create-profiles.js";

const migrations = [createProfilesMigration];
const migrationTableName = "schema_migrations";

async function ensureMigrationTable(queryInterface) {
  await queryInterface.createTable(migrationTableName, {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true,
    },
    run_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn("NOW"),
    },
  });
}

async function loadAppliedMigrations(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT name FROM ${migrationTableName}`,
  );

  return new Set(rows.map((row) => row.name));
}

export async function runMigrations() {
  const queryInterface = sequelize.getQueryInterface();
  const allTables = await queryInterface.showAllTables();
  const tableNames = allTables.map((table) =>
    typeof table === "string" ? table : table.tableName,
  );

  if (!tableNames.includes(migrationTableName)) {
    await ensureMigrationTable(queryInterface);
  }

  const appliedMigrations = await loadAppliedMigrations(queryInterface);

  for (const currentMigration of migrations) {
    if (appliedMigrations.has(currentMigration.name)) {
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      await currentMigration.up(queryInterface, Sequelize, transaction);
      await queryInterface.bulkInsert(
        migrationTableName,
        [{ name: currentMigration.name, run_at: new Date() }],
        { transaction },
      );
    });
  }
}

const currentFilePath = new URL(import.meta.url).pathname.replace(/\\/g, "/");
const isDirectExecution = process.argv[1]?.replace(/\\/g, "/") === currentFilePath;

if (isDirectExecution) {
  sequelize
    .authenticate()
    .then(() => runMigrations())
    .then(() => {
      console.log("[migrations] completed");
      return sequelize.close();
    })
    .catch(async (err) => {
      console.error("[migrations] failed", err);
      await sequelize.close().catch(() => undefined);
      process.exit(1);
    });
}