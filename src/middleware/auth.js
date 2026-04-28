const jwt = require("jsonwebtoken");
const env = require("../config/env");
const prisma = require("../lib/prisma");

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
}

module.exports = { requireAdmin };
