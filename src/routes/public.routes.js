const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { pickCartId } = require("../lib/cart");

const router = express.Router();

const addCartSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(999),
});

const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().positive().max(999),
});

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerWhatsapp: z.string().trim().min(8).max(20),
  shippingAddress: z.string().trim().min(10).max(500),
  note: z.string().trim().max(500).optional(),
});

function generateOrderCode() {
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${Date.now()}-${rand}`;
}

router.get("/products", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
    const skip = (page - 1) * limit;

    const where = { isActive: true };
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: "insensitive" } },
        { description: { contains: req.query.search, mode: "insensitive" } },
      ];
    }

    if (req.query.categoryId) {
      where.categoryId = Number(req.query.categoryId);
    }

    if (req.query.categorySlug) {
      where.category = { slug: req.query.categorySlug };
    }

    if (req.query.minPrice || req.query.maxPrice) {
      where.price = {};
      if (req.query.minPrice) where.price.gte = Number(req.query.minPrice);
      if (req.query.maxPrice) where.price.lte = Number(req.query.maxPrice);
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/products/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }
    return res.json({ data: product });
  } catch (error) {
    return next(error);
  }
});

router.post("/cart", async (req, res, next) => {
  try {
    const payload = addCartSchema.parse(req.body);
    const product = await prisma.product.findFirst({
      where: { id: payload.productId, isActive: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    if (product.stock < payload.quantity) {
      return res.status(400).json({ message: "Stok tidak mencukupi" });
    }

    const incomingCartId = pickCartId(req);
    const cart =
      (incomingCartId && (await prisma.cart.findUnique({ where: { id: incomingCartId } }))) ||
      (await prisma.cart.create({ data: {} }));

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: payload.productId,
        },
      },
    });

    const nextQty = (existingItem?.quantity || 0) + payload.quantity;
    if (nextQty > product.stock) {
      return res.status(400).json({ message: "Jumlah melebihi stok tersedia" });
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: payload.productId,
        },
      },
      update: { quantity: nextQty },
      create: {
        cartId: cart.id,
        productId: payload.productId,
        quantity: payload.quantity,
      },
    });

    return res.status(201).json({
      message: "Produk ditambahkan ke keranjang",
      cartId: cart.id,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/cart", async (req, res, next) => {
  try {
    const cartId = pickCartId(req);
    if (!cartId) {
      return res.status(400).json({ message: "cartId diperlukan (query/header x-cart-id)" });
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!cart) {
      return res.status(404).json({ message: "Keranjang tidak ditemukan" });
    }

    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    return res.json({
      data: {
        id: cart.id,
        items: cart.items,
        totalAmount,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/cart/items/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const payload = updateCartItemSchema.parse(req.body);
    const cartId = pickCartId(req);
    if (!cartId) {
      return res.status(400).json({ message: "cartId diperlukan (query/header x-cart-id)" });
    }

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item || item.cartId !== cartId) {
      return res.status(404).json({ message: "Item keranjang tidak ditemukan" });
    }

    if (payload.quantity > item.product.stock) {
      return res.status(400).json({ message: "Jumlah melebihi stok tersedia" });
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: payload.quantity },
    });

    return res.json({ message: "Jumlah item berhasil diperbarui" });
  } catch (error) {
    return next(error);
  }
});

router.delete("/cart/items/:itemId", async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const cartId = pickCartId(req);
    if (!cartId) {
      return res.status(400).json({ message: "cartId diperlukan (query/header x-cart-id)" });
    }

    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) {
      return res.status(404).json({ message: "Item keranjang tidak ditemukan" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });
    return res.json({ message: "Item dihapus dari keranjang" });
  } catch (error) {
    return next(error);
  }
});

router.post("/checkout", async (req, res, next) => {
  try {
    const payload = checkoutSchema.parse(req.body);
    const cartId = pickCartId(req);
    if (!cartId) {
      return res.status(400).json({ message: "cartId diperlukan (query/header x-cart-id)" });
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Keranjang kosong atau tidak ditemukan" });
    }

    for (const item of cart.items) {
      if (!item.product.isActive) {
        return res.status(400).json({ message: `Produk ${item.product.name} tidak aktif` });
      }
      if (item.quantity > item.product.stock) {
        return res
          .status(400)
          .json({ message: `Stok produk ${item.product.name} tidak mencukupi` });
      }
    }

    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);
    const orderCode = generateOrderCode();

    const setting = await prisma.storeSetting.findUnique({ where: { id: 1 } });

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderCode,
          customerName: payload.customerName,
          customerWhatsapp: payload.customerWhatsapp,
          shippingAddress: payload.shippingAddress,
          note: payload.note || null,
          totalAmount: String(subtotal),
          qrisImageUrl: setting?.qrisImageUrl || null,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              unitPrice: String(item.product.price),
              quantity: item.quantity,
              subtotal: String(Number(item.product.price) * item.quantity),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId } });
      return created;
    });

    return res.status(201).json({
      message: "Checkout berhasil. Silakan lakukan pembayaran QRIS.",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const orderCode = req.query.orderCode;
    const customerWhatsapp = req.query.whatsapp;

    if (!orderCode && !customerWhatsapp) {
      return res
        .status(400)
        .json({ message: "Gunakan query orderCode atau whatsapp untuk tracking order" });
    }

    const where = {};
    if (orderCode) where.orderCode = String(orderCode);
    if (customerWhatsapp) where.customerWhatsapp = String(customerWhatsapp);

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

module.exports = router;
