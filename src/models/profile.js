import { DataTypes } from "sequelize";
import { v7 as uuidv7 } from "uuid";

export function defineProfile(sequelize) {
  return sequelize.define(
    "Profile",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv7(),
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      normalized_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      gender: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      probability: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      sample_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      age_group: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country_id: {
        type: DataTypes.STRING(2),
        allowNull: false,
      },
      country_probability: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    {
      tableName: "profiles",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
}