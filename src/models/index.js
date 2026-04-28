import { sequelize } from "../config/database.js";
import { defineProfile } from "./profile.js";
import { defineRefreshToken } from "./refreshToken.js";
import { defineUser } from "./user.js";

export const Profile = defineProfile(sequelize);
export const User = defineUser(sequelize);
export const RefreshToken = defineRefreshToken(sequelize);

User.hasMany(RefreshToken, {
	foreignKey: "user_id",
	as: "refreshTokens",
});

RefreshToken.belongsTo(User, {
	foreignKey: "user_id",
	as: "user",
});