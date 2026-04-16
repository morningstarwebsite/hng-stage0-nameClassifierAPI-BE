import { sequelize } from "../config/database.js";
import { defineProfile } from "./profile.js";

export const Profile = defineProfile(sequelize);