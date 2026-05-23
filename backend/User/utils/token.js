import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return "dev_jwt_secret_change_me";
};

export const signAuthToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role || "user" },
    getJwtSecret(),
    { expiresIn: "7d" }
  );

export const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

export const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    path: "/",
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
  });
};

export const formatAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  phonenum: user.phonenum,
  email: user.email?.includes("@mobile.sheetalya.local") ? null : user.email,
  role: user.role,
});
