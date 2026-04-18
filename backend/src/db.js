const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.8,
      badge TEXT DEFAULT '',
      in_stock INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      comment TEXT DEFAULT '',
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try {
    db.exec(`ALTER TABLE orders ADD COLUMN user_id INTEGER`);
  } catch (e) {
    if (!/duplicate column/i.test(String(e.message))) throw e;
  }

  try {
    db.exec(`ALTER TABLE products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    if (!/duplicate column/i.test(String(e.message))) throw e;
  }
}

function seedProducts() {
  const count = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
  if (count > 0) return;

  const seed = [
    ["Ерудит Premium Series", "Настільна гра для всієї родини", 170, "board-games", "/images/product-erudyt-premium.jpg", 4.9, "ХІТ"],
    ["Тварини нашої планети", "Карткова гра-вікторина", 188, "board-games", "/images/product-tvaryny-planety.jpg", 4.8, "NEW"],
    ["Пазл 380 дет. «Корабель»", "Класичний пазл, 475x340 мм", 124, "puzzles", "/images/product-puzzle-380-korabel.jpg", 4.8, ""],
    ["Пазл 380 дет. «Греція»", "Класичний пазл, 475x340 мм", 124, "puzzles", "/images/product-puzzle-380-greek.jpg", 4.8, ""],
    ["Пазл 80 дет. «Казка»", "Пазл для дітей від 3 років", 83, "puzzles", "/images/product-puzzle-80-kazka.jpg", 4.7, "-15%"],
    ["Пазл 80 дет. «Квіти»", "Пазл для дітей від 3 років", 83, "puzzles", "/images/product-puzzle-80-kvity.jpg", 4.7, ""],
    ["Пазл 80 дет. «Пірати»", "Пазл для дітей від 3 років", 83, "puzzles", "/images/product-puzzle-80-piraty.jpg", 4.7, ""],
    ["Набір для килимової вишивки", "Punch Needle набір для творчості", 80, "creativity", "/images/product-kilymova-vyshyvka.jpg", 4.8, "NEW"],
    ["Зошити шкільні (набір)", "Обкладинки в асортименті", 15, "stationery", "/images/product-zoshyty.jpg", 4.8, ""],
    ["Клей конторський 200 мл", "ПВА, з дозатором", 33, "stationery", "/images/product-klej.jpg", 4.6, ""],
    ["Підставка для ручок", "2 відсіки, пластик", 68, "stationery", "/images/product-pidstavka-zelena.jpg", 4.5, ""],
    ["PopSocket тримач", "Тримач для телефону", 95, "accessories", "/images/product-popsocket.jpg", 4.7, ""],
  ];

  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, category, image, rating, badge, in_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(...item);
  });
  tx(seed);
}

runMigrations();
seedProducts();

module.exports = db;
