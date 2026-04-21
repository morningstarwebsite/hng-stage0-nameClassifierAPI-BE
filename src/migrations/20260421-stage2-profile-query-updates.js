export const migration = {
  name: "20260421-stage2-profile-query-updates",
  async up(queryInterface, Sequelize, transaction) {
    const tableDefinition = await queryInterface.describeTable("profiles");
    const [existingIndexes] = await queryInterface.sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'profiles'",
      { transaction },
    );
    const indexNames = new Set(existingIndexes.map((row) => row.indexname));

    if (!tableDefinition.country_name) {
      await queryInterface.addColumn(
        "profiles",
        "country_name",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction },
      );
    }

    if (tableDefinition.age && !indexNames.has("profiles_age_idx")) {
      await queryInterface.addIndex("profiles", ["age"], {
        name: "profiles_age_idx",
        transaction,
      });
    }

    if (tableDefinition.probability && !indexNames.has("profiles_probability_idx")) {
      await queryInterface.addIndex("profiles", ["probability"], {
        name: "profiles_probability_idx",
        transaction,
      });
    }

    if (tableDefinition.country_probability && !indexNames.has("profiles_country_probability_idx")) {
      await queryInterface.addIndex("profiles", ["country_probability"], {
        name: "profiles_country_probability_idx",
        transaction,
      });
    }

    if (tableDefinition.created_at && !indexNames.has("profiles_created_at_idx")) {
      await queryInterface.addIndex("profiles", ["created_at"], {
        name: "profiles_created_at_idx",
        transaction,
      });
    }
  },
};