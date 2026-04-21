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
        unique: true,
      },
      gender: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      gender_probability: {
        type: Sequelize.FLOAT,
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
      country_name: {
        type: Sequelize.STRING,
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
    }, { transaction });

    await queryInterface.addConstraint("profiles", {
      fields: ["gender"],
      type: "check",
      name: "profiles_gender_check",
      where: {
        gender: ["male", "female"],
      },
      transaction,
    });

    await queryInterface.addConstraint("profiles", {
      fields: ["age_group"],
      type: "check",
      name: "profiles_age_group_check",
      where: {
        age_group: ["child", "teenager", "adult", "senior"],
      },
      transaction,
    });

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
    await queryInterface.addIndex("profiles", ["age"], {
      name: "profiles_age_idx",
      transaction,
    });
    await queryInterface.addIndex("profiles", ["gender_probability"], {
      name: "profiles_gender_probability_idx",
      transaction,
    });
    await queryInterface.addIndex("profiles", ["country_probability"], {
      name: "profiles_country_probability_idx",
      transaction,
    });
    await queryInterface.addIndex("profiles", ["created_at"], {
      name: "profiles_created_at_idx",
      transaction,
    });
  },
};