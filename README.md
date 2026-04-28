PRODUCT REQUIREMENTS DOCUMENT (PRD) Project: Website E-Commerce
Sederhana (QRIS Payment)

1.  TUJUAN PRODUK Membangun website e-commerce sederhana yang
    memungkinkan user menjelajahi produk, melakukan pembelian, dan
    menggunakan pembayaran QRIS.

2.  TARGET USER

- Customer: pengguna yang ingin membeli produk
- Admin: pengelola toko

3.  PROBLEM STATEMENT UMKM membutuhkan platform sederhana untuk menjual
    produk dan menerima pembayaran digital tanpa bergantung pada
    marketplace.

4.  FITUR UTAMA USER:

- Browse produk
- Search & filter kategori
- Cart (tambah, update, hapus)
- Checkout (nama, no WA, alamat)
- Pembayaran QRIS
- Order tracking sederhana

ADMIN: - Login - CRUD produk - CRUD kategori - Kelola order - Upload
QRIS

5.  USER FLOW User: Homepage → Pilih produk → Add to cart → Checkout →
    Isi data → Scan QRIS → Selesai

Admin: Login → Kelola produk → Lihat order → Update status

6.  TEKNOLOGI Frontend: Next.js, React Backend: Next.js API / Backend
    terpisah Database: PostgreSQL / MySQL ORM: Prisma

7.  DATA MODEL

- Users
- Products
- Categories
- Orders
- Order Items

8.  API ENDPOINT GET /api/products GET /api/products/:id POST /api/cart
    GET /api/cart POST /api/checkout GET /api/orders PATCH
    /api/orders/:id

9.  NON-FUNCTIONAL

- Performance cepat (<3 detik)
- Mobile friendly
- Validasi input
- Keamanan password (hash)

10. FUTURE IMPROVEMENTS

- Payment gateway (Midtrans/Xendit)
- Integrasi WhatsApp
- Notifikasi otomatis
- Review produk

---

## Implementasi Backend (Sudah Dibuat)

Backend sudah dibuat menggunakan:

- Node.js + Express
- Prisma ORM
- PostgreSQL (default di `.env.example`)
- JWT auth untuk admin
- Upload QRIS image dengan Multer

### Struktur Utama

- `src/server.js` - entry server
- `src/app.js` - konfigurasi express + route
- `src/routes/public.routes.js` - endpoint customer/public
- `src/routes/admin.routes.js` - endpoint admin
- `src/middleware/auth.js` - middleware auth admin
- `prisma/schema.prisma` - data model
- `prisma/seed.js` - seed admin awal

### Cara Menjalankan

1. Install dependencies:

```bash
npm install
```

2. Copy env (PowerShell):

```bash
Copy-Item .env.example .env
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Jalankan migrasi:

```bash
npm run prisma:migrate
```

5. Seed admin awal:

```bash
npm run prisma:seed
```

6. Jalankan backend:

```bash
npm run dev
```

Server default jalan di `http://localhost:4000`.

### Endpoint Utama (PRD + Tambahan Operasional)

Public:

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/cart`
- `GET /api/cart`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/checkout`
- `GET /api/orders`

Admin:

- `POST /api/admin/login`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/orders`
- `PATCH /api/orders/:id`
- `POST /api/admin/qris` (form-data key: `qrisImage`)
