async function loadTableNames(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = current_schema()",
    { transaction },
  );

  return new Set(rows.map((row) => row.tablename));
}

async function loadIndexNames(queryInterface, tableName, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = '${tableName}'`,
    { transaction },
  );

  return new Set(rows.map((row) => row.indexname));
}

export const migration = {
  name: "20260428-stage3-auth-and-security",
  async up(queryInterface, Sequelize, transaction) {
    const tableNames = await loadTableNames(queryInterface, transaction);

    if (!tableNames.has("users")) {
      await queryInterface.createTable(
        "users",
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
          },
          github_id: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },
          username: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          email: {
            type: Sequelize.STRING,
            allowNull: true,
          },
          avatar_url: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          role: {
            type: Sequelize.ENUM("admin", "analyst"),
            allowNull: false,
            defaultValue: "analyst",
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          last_login_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn("NOW"),
          },
        },
        { transaction },
      );
    }

    if (!tableNames.has("refresh_tokens")) {
      await queryInterface.createTable(
        "refresh_tokens",
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "users",
              key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
          token_hash: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
          },
          expires_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          revoked_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          replaced_by_token_id: {
            type: Sequelize.UUID,
            allowNull: true,
          },
          user_agent: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          ip_address: {
            type: Sequelize.STRING,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn("NOW"),
          },
        },
        { transaction },
      );
    }

    const userIndexes = await loadIndexNames(queryInterface, "users", transaction);
    const refreshIndexes = await loadIndexNames(queryInterface, "refresh_tokens", transaction);

    if (!userIndexes.has("users_github_id_idx")) {
      await queryInterface.addIndex("users", ["github_id"], {
        name: "users_github_id_idx",
        unique: true,
        transaction,
      });
    }

    if (!userIndexes.has("users_role_idx")) {
      await queryInterface.addIndex("users", ["role"], {
        name: "users_role_idx",
        transaction,
      });
    }

    if (!refreshIndexes.has("refresh_tokens_user_id_idx")) {
      await queryInterface.addIndex("refresh_tokens", ["user_id"], {
        name: "refresh_tokens_user_id_idx",
        transaction,
      });
    }

    if (!refreshIndexes.has("refresh_tokens_expires_at_idx")) {
      await queryInterface.addIndex("refresh_tokens", ["expires_at"], {
        name: "refresh_tokens_expires_at_idx",
        transaction,
      });
    }
  },
};
