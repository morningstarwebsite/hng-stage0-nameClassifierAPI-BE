import "dotenv/config";
import { Sequelize } from "sequelize";
import { runMigrations } from "../migrations/runMigrations.js";

const commonOptions = {
  dialect: "postgres",
  logging: false,
};

function buildSequelizeInstance() {
  if (process.env.DATABASE_URL) {
    return new Sequelize(process.env.DATABASE_URL, {
      ...commonOptions,
      dialectOptions:
        process.env.NODE_ENV === "production"
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : undefined,
    });
  }

  return new Sequelize(
    process.env.DB_NAME || "profile_intelligence",
    process.env.DB_USER || "postgres",
    process.env.DB_PASSWORD || "",
    {
      ...commonOptions,
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
    },
  );
}

export const sequelize = buildSequelizeInstance();

export async function connectDatabase() {
  await sequelize.authenticate();
  await runMigrations();
}