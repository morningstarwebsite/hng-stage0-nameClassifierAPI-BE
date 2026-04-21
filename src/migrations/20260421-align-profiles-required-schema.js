import { getCountryName } from "../services/countryLookupService.js";

async function loadExistingIndexes(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'profiles'",
    { transaction },
  );

  return new Set(rows.map((row) => row.indexname));
}

async function loadExistingConstraints(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass`,
    { transaction },
  );

  return new Set(rows.map((row) => row.conname));
}

async function removeIndexIfExists(queryInterface, indexNames, indexName, transaction) {
  if (indexNames.has(indexName)) {
    await queryInterface.removeIndex("profiles", indexName, { transaction });
  }
}

export const migration = {
  name: "20260421-align-profiles-required-schema",
  async up(queryInterface, Sequelize, transaction) {
    const tableDefinition = await queryInterface.describeTable("profiles");
    const indexNames = await loadExistingIndexes(queryInterface, transaction);
    const constraintNames = await loadExistingConstraints(queryInterface, transaction);

    // Existing Stage 1 data is renamed in place so the table keeps its contents during alignment.
    if (tableDefinition.probability && !tableDefinition.gender_probability) {
      await queryInterface.renameColumn("profiles", "probability", "gender_probability", { transaction });
    }

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

    const [countryRows] = await queryInterface.sequelize.query(
      "SELECT id, country_id FROM profiles WHERE country_name IS NULL OR btrim(country_name) = ''",
      { transaction },
    );

    // Backfill before enforcing NOT NULL so older rows remain valid after the migration.
    for (const row of countryRows) {
      await queryInterface.bulkUpdate(
        "profiles",
        { country_name: getCountryName(row.country_id) || row.country_id },
        { id: row.id },
        { transaction },
      );
    }

    if (tableDefinition.normalized_name) {
      await queryInterface.removeColumn("profiles", "normalized_name", { transaction });
    }

    if (tableDefinition.sample_size) {
      await queryInterface.removeColumn("profiles", "sample_size", { transaction });
    }

    if (tableDefinition.updated_at) {
      await queryInterface.removeColumn("profiles", "updated_at", { transaction });
    }

    // The final schema is strict: only the required assessment columns remain and all are non-null.
    await queryInterface.changeColumn(
      "profiles",
      "name",
      {
        type: Sequelize.STRING,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "gender",
      {
        type: Sequelize.STRING,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "gender_probability",
      {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "age",
      {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "age_group",
      {
        type: Sequelize.STRING,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "country_id",
      {
        type: Sequelize.STRING(2),
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "country_name",
      {
        type: Sequelize.STRING,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "country_probability",
      {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      { transaction },
    );
    await queryInterface.changeColumn(
      "profiles",
      "created_at",
      {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      { transaction },
    );

    await removeIndexIfExists(queryInterface, indexNames, "profiles_probability_idx", transaction);

    // Recreate lookup indexes against the final column names used by Stage 2 queries.
    if (!indexNames.has("profiles_name_unique_idx")) {
      await queryInterface.addIndex("profiles", ["name"], {
        name: "profiles_name_unique_idx",
        unique: true,
        transaction,
      });
    }

    if (!indexNames.has("profiles_gender_probability_idx")) {
      await queryInterface.addIndex("profiles", ["gender_probability"], {
        name: "profiles_gender_probability_idx",
        transaction,
      });
    }

    if (!indexNames.has("profiles_age_idx")) {
      await queryInterface.addIndex("profiles", ["age"], {
        name: "profiles_age_idx",
        transaction,
      });
    }

    if (!indexNames.has("profiles_country_probability_idx")) {
      await queryInterface.addIndex("profiles", ["country_probability"], {
        name: "profiles_country_probability_idx",
        transaction,
      });
    }

    if (!indexNames.has("profiles_created_at_idx")) {
      await queryInterface.addIndex("profiles", ["created_at"], {
        name: "profiles_created_at_idx",
        transaction,
      });
    }

    if (!constraintNames.has("profiles_gender_check")) {
      await queryInterface.addConstraint("profiles", {
        fields: ["gender"],
        type: "check",
        name: "profiles_gender_check",
        where: {
          gender: ["male", "female"],
        },
        transaction,
      });
    }

    if (!constraintNames.has("profiles_age_group_check")) {
      await queryInterface.addConstraint("profiles", {
        fields: ["age_group"],
        type: "check",
        name: "profiles_age_group_check",
        where: {
          age_group: ["child", "teenager", "adult", "senior"],
        },
        transaction,
      });
    }
  },
};