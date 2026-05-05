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
  name: "20260504-stage4-performance-indexes",
  async up(queryInterface, _Sequelize, transaction) {
    const tableNames = await loadTableNames(queryInterface, transaction);

    if (!tableNames.has("profiles")) {
      return;
    }

    const profileIndexes = await loadIndexNames(queryInterface, "profiles", transaction);

    if (!profileIndexes.has("profiles_lower_name_idx")) {
      await queryInterface.sequelize.query(
        "CREATE INDEX profiles_lower_name_idx ON profiles ((LOWER(name)))",
        { transaction },
      );
    }

    if (!profileIndexes.has("profiles_created_at_id_idx")) {
      await queryInterface.addIndex(
        "profiles",
        [
          { name: "created_at", order: "DESC" },
          { name: "id", order: "ASC" },
        ],
        {
          name: "profiles_created_at_id_idx",
          transaction,
        },
      );
    }

    if (!profileIndexes.has("profiles_age_id_idx")) {
      await queryInterface.addIndex(
        "profiles",
        [
          { name: "age", order: "ASC" },
          { name: "id", order: "ASC" },
        ],
        {
          name: "profiles_age_id_idx",
          transaction,
        },
      );
    }

    if (!profileIndexes.has("profiles_gender_probability_id_idx")) {
      await queryInterface.addIndex(
        "profiles",
        [
          { name: "gender_probability", order: "DESC" },
          { name: "id", order: "ASC" },
        ],
        {
          name: "profiles_gender_probability_id_idx",
          transaction,
        },
      );
    }

    if (!profileIndexes.has("profiles_filter_triplet_idx")) {
      await queryInterface.addIndex("profiles", ["gender", "age_group", "country_id"], {
        name: "profiles_filter_triplet_idx",
        transaction,
      });
    }
  },
};
