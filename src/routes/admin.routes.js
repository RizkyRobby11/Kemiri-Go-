const fs = require("fs");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const env = require("../config/env");
const { requireAdmin } = require("../middleware/auth");
const { createSlug } = require("../lib/slug");

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `qris-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0),
  imageUrl: z.string().url().optional(),
  isActive: z.coerce.boolean().optional(),
  categoryId: z.coerce.number().int().positive(),
});

const updateOrderSchema = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"]),
});

router.post("/admin/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const validPassword = await bcrypt.compare(payload.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    });

    return res.json({
      message: "Login berhasil",
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/categories", requireAdmin, async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: categories });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/categories", requireAdmin, async (req, res, next) => {
  try {
    const payload = categorySchema.parse(req.body);
    const baseSlug = createSlug(payload.name);
    const exists = await prisma.category.count({
      where: { slug: { startsWith: baseSlug } },
    });
    const slug = exists ? `${baseSlug}-${exists + 1}` : baseSlug;

    const category = await prisma.category.create({
      data: {
        name: payload.name,
        slug,
      },
    });

    return res.status(201).json({ message: "Kategori berhasil dibuat", data: category });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = categorySchema.parse(req.body);
    const baseSlug = createSlug(payload.name);
    const exists = await prisma.category.count({
      where: {
        slug: { startsWith: baseSlug },
        id: { not: id },
      },
    });
    const slug = exists ? `${baseSlug}-${exists + 1}` : baseSlug;

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: payload.name,
        slug,
      },
    });

    return res.json({ message: "Kategori berhasil diperbarui", data: category });
  } catch (error) {
    return next(error);
  }
});

router.delete("/admin/categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const products = await prisma.product.count({ where: { categoryId: id } });
    if (products > 0) {
      return res.status(400).json({
        message: "Kategori masih memiliki produk. Hapus atau pindahkan produk terlebih dahulu.",
      });
    }

    await prisma.category.delete({ where: { id } });
    return res.json({ message: "Kategori berhasil dihapus" });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/products", requireAdmin, async (req, res, next) => {
  try {
    const search = req.query.search || "";
    const where = search
      ? {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { description: { contains: String(search), mode: "insensitive" } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: products });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/products", requireAdmin, async (req, res, next) => {
  try {
    const payload = productSchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: payload.categoryId } });
    if (!category) {
      return res.status(404).json({ message: "Kategori tidak ditemukan" });
    }

    const baseSlug = createSlug(payload.name);
    const exists = await prisma.product.count({
      where: { slug: { startsWith: baseSlug } },
    });
    const slug = exists ? `${baseSlug}-${exists + 1}` : baseSlug;

    const product = await prisma.product.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description || null,
        price: String(payload.price),
        stock: payload.stock,
        imageUrl: payload.imageUrl || null,
        isActive: payload.isActive ?? true,
        categoryId: payload.categoryId,
      },
      include: { category: true },
    });

    return res.status(201).json({ message: "Produk berhasil dibuat", data: product });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/products/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = productSchema.partial().parse(req.body);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    let slug = existing.slug;
    if (payload.name && payload.name !== existing.name) {
      const baseSlug = createSlug(payload.name);
      const exists = await prisma.product.count({
        where: {
          slug: { startsWith: baseSlug },
          id: { not: id },
        },
      });
      slug = exists ? `${baseSlug}-${exists + 1}` : baseSlug;
    }

    if (payload.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: payload.categoryId } });
      if (!category) {
        return res.status(404).json({ message: "Kategori tidak ditemukan" });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: payload.name ?? existing.name,
        slug,
        description: payload.description ?? existing.description,
        price: payload.price != null ? String(payload.price) : existing.price,
        stock: payload.stock ?? existing.stock,
        imageUrl: payload.imageUrl ?? existing.imageUrl,
        isActive: payload.isActive ?? existing.isActive,
        categoryId: payload.categoryId ?? existing.categoryId,
      },
      include: { category: true },
    });

    return res.json({ message: "Produk berhasil diperbarui", data: product });
  } catch (error) {
    return next(error);
  }
});

router.delete("/admin/products/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    return res.json({ message: "Produk berhasil dihapus" });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/orders", requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status;
    const allowedStatuses = [
      "PENDING_PAYMENT",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "COMPLETED",
      "CANCELED",
    ];
    if (status && !allowedStatuses.includes(String(status))) {
      return res.status(400).json({ message: "Status order tidak valid" });
    }

    const where = status ? { status: String(status) } : {};
    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: orders });
  } catch (error) {
    return next(error);
  }
});

router.patch("/orders/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updateOrderSchema.parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { status: payload.status },
      include: { items: true },
    });
    return res.json({ message: "Status order berhasil diperbarui", data: order });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/qris", requireAdmin, upload.single("qrisImage"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File qrisImage wajib diupload" });
    }

    const relativePath = `/uploads/${req.file.filename}`;
    const setting = await prisma.storeSetting.upsert({
      where: { id: 1 },
      update: { qrisImageUrl: relativePath },
      create: { id: 1, qrisImageUrl: relativePath },
    });

    return res.json({
      message: "QRIS berhasil diperbarui",
      data: setting,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
