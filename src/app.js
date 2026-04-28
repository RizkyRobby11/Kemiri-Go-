const path = require("path");
const cors = require("cors");
const express = require("express");
const publicRoutes = require("./routes/public.routes");
const adminRoutes = require("./routes/admin.routes");
const { errorHandler } = require("./middleware/error-handler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api", publicRoutes);
app.use("/api", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

app.use(errorHandler);

module.exports = app;
