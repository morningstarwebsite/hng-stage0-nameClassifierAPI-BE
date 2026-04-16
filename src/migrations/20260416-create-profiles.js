export const migration = {
  name: "20260416-create-profiles",
  async up(queryInterface, Sequelize, transaction) {
    await queryInterface.createTable("profiles", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      normalized_name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      gender: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      probability: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      sample_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      age: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      age_group: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country_id: {
        type: Sequelize.STRING(2),
        allowNull: false,
      },
      country_probability: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    }, { transaction });

    await queryInterface.addIndex("profiles", ["gender"], {
      name: "profiles_gender_idx",
      transaction,
    });
    await queryInterface.addIndex("profiles", ["country_id"], {
      name: "profiles_country_id_idx",
      transaction,
    });
    await queryInterface.addIndex("profiles", ["age_group"], {
      name: "profiles_age_group_idx",
      transaction,
    });
  },
};