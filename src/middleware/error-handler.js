function errorHandler(error, _req, res, _next) {
  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Validasi gagal",
      errors: error.errors.map((entry) => ({
        path: entry.path.join("."),
        message: entry.message,
      })),
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ message: "Data tidak ditemukan" });
  }

  console.error(error);
  return res.status(500).json({ message: "Terjadi kesalahan pada server" });
}

module.exports = { errorHandler };
