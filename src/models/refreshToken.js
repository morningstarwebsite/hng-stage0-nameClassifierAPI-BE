import { DataTypes } from "sequelize";
import { v7 as uuidv7 } from "uuid";

export function defineRefreshToken(sequelize) {
  return sequelize.define(
    "RefreshToken",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv7(),
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      token_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      replaced_by_token_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "refresh_tokens",
      timestamps: false,
    },
  );
}
