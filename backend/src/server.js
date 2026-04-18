require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("./db");

const app = express();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const PORT = Number(process.env.PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
const JWT_SECRET = requireEnv("JWT_SECRET");

const uploadDir = path.join(__dirname, "..", "..", "images", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: false }));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(express.json({ limit: "5mb" }));

const imagesDir = path.join(__dirname, "..", "..", "images");
app.use("/images", express.static(imagesDir));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Забагато спроб входу. Повторіть пізніше." },
});

app.use("/api", globalLimiter);
app.use("/api/admin/login", loginLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Дозволені тільки зображення"));
  },
});

const categories = [
  { id: "all", label: "Усі товари" },
  { id: "board-games", label: "Настільні ігри" },
  { id: "puzzles", label: "Пазли" },
  { id: "coloring", label: "Розмальовки" },
  { id: "stationery", label: "Канцтовари" },
  { id: "creativity", label: "Творчість" },
  { id: "accessories", label: "Аксесуари" },
];

function authAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Необхідна авторизація" });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Потрібні права адміністратора" });
    }
    req.user = user;
    next();
  } catch (_err) {
    res.status(401).json({ message: "Сесія недійсна" });
  }
}

function userAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Увійдіть у кабінет" });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== "user" || !user.id) {
      return res.status(403).json({ message: "Потрібен обліковий запис покупця" });
    }
    req.user = user;
    next();
  } catch (_err) {
    res.status(401).json({ message: "Сесія недійсна" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/categories", (_req, res) => {
  res.json(categories);
});

app.post("/api/admin/login", (req, res) => {
  const schema = z.object({ password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Невірний формат" });
  if (parsed.data.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Невірний пароль" });
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(200),
  name: z.string().min(2).max(120),
});

const loginUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

app.post("/api/auth/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Перевірте email, ім'я та пароль (мін. 6 символів)" });
  }
  const email = normalizeEmail(parsed.data.email);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ message: "Цей email уже зареєстровано" });
  }
  const password_hash = bcrypt.hashSync(parsed.data.password, 10);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(email, password_hash, parsed.data.name.trim());
  const id = result.lastInsertRowid;
  const token = jwt.sign({ id, role: "user", email }, JWT_SECRET, { expiresIn: "14d" });
  const row = db.prepare("SELECT id, email, name, phone, created_at FROM users WHERE id = ?").get(id);
  res.status(201).json({ token, user: row });
});

app.post("/api/auth/login", (req, res) => {
  const parsed = loginUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Введіть email та пароль" });
  }
  const email = normalizeEmail(parsed.data.email);
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash)) {
    return res.status(401).json({ message: "Невірний email або пароль" });
  }
  const token = jwt.sign({ id: row.id, role: "user", email: row.email }, JWT_SECRET, { expiresIn: "14d" });
  const safe = {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    created_at: row.created_at,
  };
  res.json({ token, user: safe });
});

app.get("/api/auth/me", userAuth, (req, res) => {
  const row = db
    .prepare("SELECT id, email, name, phone, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  if (!row) return res.status(404).json({ message: "Користувача не знайдено" });
  res.json(row);
});

const profilePatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(50).optional(),
});

app.patch("/api/auth/profile", userAuth, (req, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Невірні дані профілю" });
  const data = parsed.data;
  const updates = [];
  const values = [];
  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name.trim());
  }
  if (data.phone !== undefined) {
    updates.push("phone = ?");
    values.push(data.phone.trim());
  }
  if (updates.length === 0) {
    const row = db
      .prepare("SELECT id, email, name, phone, created_at FROM users WHERE id = ?")
      .get(req.user.id);
    return res.json(row);
  }
  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const row = db
    .prepare("SELECT id, email, name, phone, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  res.json(row);
});

app.get("/api/user/orders", userAuth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC")
    .all(req.user.id);
  const mapped = rows.map((r) => ({ ...r, items: JSON.parse(r.items_json) }));
  res.json(mapped);
});

app.post("/api/upload", authAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Файл не завантажено" });
  const image = `/images/uploads/${req.file.filename}`;
  res.status(201).json({ image });
});

app.get("/api/products", (req, res) => {
  const category = req.query.category;
  const stockRaw = req.query.in_stock;
  const clauses = [];
  const params = [];
  if (category && category !== "all") {
    clauses.push("category = ?");
    params.push(category);
  }
  if (stockRaw === "0" || stockRaw === "1") {
    clauses.push("in_stock = ?");
    params.push(Number(stockRaw));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM products ${where} ORDER BY id DESC`).all(...params);
  res.json(rows);
});

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  price: z.number().int().positive(),
  category: z.string().min(2),
  image: z.string().min(1),
  rating: z.number().min(1).max(5).default(4.8),
  badge: z.string().default(""),
  in_stock: z.boolean().default(true),
  quantity: z.number().int().min(0).default(0),
});

app.post("/api/products", authAdmin, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Помилка валідації", issues: parsed.error.issues });
  }
  const p = parsed.data;
  const row = db
    .prepare(
      `INSERT INTO products (name, description, price, category, image, rating, badge, in_stock, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      p.name,
      p.description,
      p.price,
      p.category,
      p.image,
      p.rating,
      p.badge,
      p.in_stock ? 1 : 0,
      p.quantity
    );
  const created = db.prepare("SELECT * FROM products WHERE id = ?").get(row.lastInsertRowid);
  res.status(201).json(created);
});

app.put("/api/products/:id", authAdmin, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Помилка валідації", issues: parsed.error.issues });
  }
  const id = Number(req.params.id);
  const p = parsed.data;
  const result = db
    .prepare(
      `UPDATE products
       SET name = ?, description = ?, price = ?, category = ?, image = ?, rating = ?, badge = ?, in_stock = ?, quantity = ?
       WHERE id = ?`
    )
    .run(p.name, p.description, p.price, p.category, p.image, p.rating, p.badge, p.in_stock ? 1 : 0, p.quantity, id);
  if (result.changes === 0) return res.status(404).json({ message: "Товар не знайдено" });
  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json(updated);
});

app.delete("/api/products/:id", authAdmin, (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ message: "Товар не знайдено" });
  res.status(204).send();
});

const orderSchema = z.object({
  customer_name: z.string().min(2),
  phone: z.string().min(5),
  city: z.string().min(2),
  comment: z.string().optional().default(""),
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      price: z.number().int().positive(),
      qty: z.number().int().positive(),
      image: z.string(),
    })
  ).min(1),
});

app.post("/api/orders", userAuth, (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Помилка валідації", issues: parsed.error.issues });
  }
  const data = parsed.data;
  for (const line of data.items) {
    const row = db.prepare("SELECT in_stock FROM products WHERE id = ?").get(line.id);
    if (!row) {
      return res.status(400).json({ message: `Товар #${line.id} не знайдено` });
    }
    if (!row.in_stock) {
      return res.status(400).json({ message: `Товар «${line.name}» зараз недоступний для замовлення` });
    }
  }
  const total = data.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const userId = req.user.id;
  const result = db
    .prepare(
      `INSERT INTO orders (customer_name, phone, city, comment, total, status, items_json, user_id)
       VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`
    )
    .run(
      data.customer_name,
      data.phone,
      data.city,
      data.comment,
      total,
      JSON.stringify(data.items),
      userId
    );

  res.status(201).json({
    id: result.lastInsertRowid,
    total,
    status: "new",
  });
});

app.get("/api/orders", authAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  const mapped = rows.map((r) => ({ ...r, items: JSON.parse(r.items_json) }));
  res.json(mapped);
});

app.patch("/api/orders/:id/status", authAdmin, (req, res) => {
  const id = Number(req.params.id);
  const statusSchema = z.object({ status: z.enum(["new", "processing", "done", "cancelled"]) });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Невірний статус" });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(parsed.data.status, id);
  if (result.changes === 0) return res.status(404).json({ message: "Замовлення не знайдено" });
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Помилка завантаження: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ message: err.message || "Помилка запиту" });
  }
  return res.status(500).json({ message: "Невідома помилка" });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
