import "dotenv/config";
import { Sequelize } from "sequelize";
import { runMigrations } from "../migrations/runMigrations.js";

const commonOptions = {
  dialect: "postgres",
  logging: false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 0),
    acquire: Number(process.env.DB_POOL_ACQUIRE_MS || 30_000),
    idle: Number(process.env.DB_POOL_IDLE_MS || 10_000),
    evict: Number(process.env.DB_POOL_EVICT_MS || 1_000),
  },
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