import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ShoppingCart,
  Heart,
  PlusCircle,
  Trash2,
  X,
  Shield,
  LogOut,
  User,
} from "lucide-react";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.trim() || "/api",
});

/** Шляхи на кшталт /images/... з урахуванням `base` (деплой у підкаталог, напр. GitHub Pages). */
function assetUrl(path) {
  if (path == null || path === "") return "";
  const s = String(path).trim();
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  const noLead = s.startsWith("/") ? s.slice(1) : s;
  return `${import.meta.env.BASE_URL}${noLead}`;
}

const categories = [
  { id: "all", label: "Усі товари" },
  { id: "board-games", label: "Настільні ігри" },
  { id: "puzzles", label: "Пазли" },
  { id: "coloring", label: "Розмальовки" },
  { id: "stationery", label: "Канцтовари" },
  { id: "creativity", label: "Творчість" },
  { id: "accessories", label: "Аксесуари" },
];

function isProductInStock(p) {
  if (p == null) return false;
  return p.in_stock === 1 || p.in_stock === true;
}

const SITE_MUSIC_SRC = "/images/muz/Клякса Маркетплейс.mp3";
const SITE_MUSIC_ICON = "/images/muz/6351681380.jpg";

const initialForm = {
  name: "",
  description: "",
  price: 0,
  category: "board-games",
  image: "/images/klyaksa-photo-001.jpg",
  rating: 4.8,
  badge: "",
  in_stock: true,
  quantity: 0,
};

function App() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [imagePanel, setImagePanel] = useState(null);
  const [cart, setCart] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favorite_ids") || "[]");
    } catch (_err) {
      return [];
    }
  });
  const [adminToken, setAdminToken] = useState(localStorage.getItem("admin_token") || "");
  const [adminClicks, setAdminClicks] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadPreview, setUploadPreview] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [sizeInfo, setSizeInfo] = useState({ original: 0, compressed: 0 });
  const [checkout, setCheckout] = useState({ customer_name: "", phone: "", city: "", comment: "" });
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [userToken, setUserToken] = useState(() => localStorage.getItem("user_token") || "");
  const [userProfile, setUserProfile] = useState(null);
  const [userAuthOpen, setUserAuthOpen] = useState(false);
  const [userAuthTab, setUserAuthTab] = useState("login");
  const [userLogin, setUserLogin] = useState({ email: "", password: "" });
  const [userRegister, setUserRegister] = useState({ email: "", password: "", name: "" });
  const [userAuthError, setUserAuthError] = useState("");
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [profileEdit, setProfileEdit] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [adminOnlyOutOfStock, setAdminOnlyOutOfStock] = useState(false);
  /** Чернетка кількості на картці (для адміна), ключ — id товару */
  const [adminQtyDraft, setAdminQtyDraft] = useState({});
  const musicRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);

  const isAdmin = Boolean(adminToken);

  const filteredProducts = useMemo(() => {
    let list = category === "all" ? products : products.filter((p) => p.category === category);
    if (isAdmin && adminOnlyOutOfStock) {
      list = list.filter((p) => !isProductInStock(p));
    }
    return list;
  }, [products, category, isAdmin, adminOnlyOutOfStock]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );

  const favoriteProducts = useMemo(
    () => products.filter((p) => favoriteIds.includes(p.id)),
    [products, favoriteIds]
  );

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    setAdminQtyDraft((prev) => {
      const next = { ...prev };
      for (const p of products) {
        next[p.id] = String(p.quantity ?? 0);
      }
      return next;
    });
  }, [products]);

  useEffect(() => {
    if (!userToken) {
      setUserProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        if (cancelled) return;
        setUserProfile(res.data);
        setProfileEdit({ name: res.data.name || "", phone: res.data.phone || "" });
        setCheckout((c) => ({
          ...c,
          customer_name: c.customer_name || res.data.name || "",
          phone: c.phone || res.data.phone || "",
        }));
      } catch {
        if (cancelled) return;
        localStorage.removeItem("user_token");
        setUserToken("");
        setUserProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userToken]);

  useEffect(() => {
    localStorage.setItem("favorite_ids", JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  async function loadProducts() {
    setLoading(true);
    const res = await api.get("/products");
    setProducts(res.data);
    setLoading(false);
  }

  function addToCart(product) {
    if (!isProductInStock(product)) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: product.id, name: product.name, image: product.image, price: product.price, qty: 1 }];
    });
    setCartOpen(true);
  }

  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleFavorite(productId) {
    setFavoriteIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }

  function handleLogoClick() {
    setAdminClicks((prev) => prev + 1);
    setTimeout(() => setAdminClicks(0), 2500);
  }

  function toggleSiteMusic() {
    const el = musicRef.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => setMusicOn(true))
        .catch(() => setMusicOn(false));
    } else {
      el.pause();
      setMusicOn(false);
    }
  }

  useEffect(() => {
    return () => {
      musicRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (adminClicks >= 5 && !isAdmin) {
      setAuthOpen(true);
      setAdminClicks(0);
    }
  }, [adminClicks, isAdmin]);

  async function performAdminLogin(rawPassword) {
    const safePassword = String(rawPassword || "").trim();
    if (!safePassword) {
      setAuthError("Введіть пароль");
      return;
    }
    try {
      const res = await api.post("/admin/login", { password: safePassword });
      localStorage.setItem("admin_token", res.data.token);
      setAdminToken(res.data.token);
      setPassword("");
      setAuthOpen(false);
      setAuthError("");
    } catch (err) {
      setAuthError(err.response?.data?.message || "Помилка входу");
    }
  }

  async function adminLogin(e) {
    e.preventDefault();
    await performAdminLogin(password);
  }

  async function pasteAndLogin() {
    let value = "";
    try {
      // Clipboard API may be blocked depending on browser/privacy settings.
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        value = (text || "").trim();
      }
    } catch (err) {
      value = "";
    }

    // Fallback for browsers where clipboard read is denied.
    if (!value) {
      const manual = window.prompt("Вставте пароль адміністратора:");
      value = (manual || "").trim();
    }

    if (!value) {
      setAuthError("Не вдалося отримати пароль з буфера");
      return;
    }

    setPassword(value);
    await performAdminLogin(value);
  }

  function adminLogout() {
    localStorage.removeItem("admin_token");
    setAdminToken("");
    closeForm();
  }

  async function performUserLogin() {
    setUserAuthError("");
    try {
      const res = await api.post("/auth/login", {
        email: userLogin.email.trim(),
        password: userLogin.password,
      });
      localStorage.setItem("user_token", res.data.token);
      setUserToken(res.data.token);
      setUserProfile(res.data.user);
      setProfileEdit({
        name: res.data.user.name || "",
        phone: res.data.user.phone || "",
      });
      setUserLogin({ email: "", password: "" });
      setUserAuthOpen(false);
    } catch (err) {
      setUserAuthError(err.response?.data?.message || "Помилка входу");
    }
  }

  async function performUserRegister() {
    setUserAuthError("");
    try {
      const res = await api.post("/auth/register", {
        email: userRegister.email.trim(),
        password: userRegister.password,
        name: userRegister.name.trim(),
      });
      localStorage.setItem("user_token", res.data.token);
      setUserToken(res.data.token);
      setUserProfile(res.data.user);
      setProfileEdit({
        name: res.data.user.name || "",
        phone: res.data.user.phone || "",
      });
      setUserRegister({ email: "", password: "", name: "" });
      setUserAuthOpen(false);
    } catch (err) {
      setUserAuthError(err.response?.data?.message || "Помилка реєстрації");
    }
  }

  function userLogout() {
    localStorage.removeItem("user_token");
    setUserToken("");
    setUserProfile(null);
    setCabinetOpen(false);
    setMyOrders([]);
  }

  async function loadMyOrders() {
    if (!userToken) return;
    try {
      const res = await api.get("/user/orders", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setMyOrders(res.data);
    } catch {
      setMyOrders([]);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!userToken) return;
    setProfileSaving(true);
    try {
      const res = await api.patch(
        "/auth/profile",
        { name: profileEdit.name.trim(), phone: profileEdit.phone.trim() },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      setUserProfile(res.data);
    } catch {
      /* ignore */
    } finally {
      setProfileSaving(false);
    }
  }

  function orderStatusLabel(s) {
    const map = {
      new: "Нове",
      processing: "В обробці",
      done: "Виконано",
      cancelled: "Скасовано",
    };
    return map[s] || s;
  }

  function closeForm() {
    setFormOpen(false);
    setForm(initialForm);
    setUploadError("");
    setSizeInfo({ original: 0, compressed: 0 });
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview("");
    }
  }

  function openForm() {
    setForm(initialForm);
    setUploadError("");
    setSizeInfo({ original: 0, compressed: 0 });
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview("");
    }
    setFormOpen(true);
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  async function saveProduct(e) {
    e.preventDefault();
    const payload = {
      ...form,
      price: Number(form.price),
      rating: Number(form.rating),
      in_stock: Boolean(form.in_stock),
      quantity: Math.max(0, Math.floor(Number(form.quantity)) || 0),
    };
    await api.post("/products", payload, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    closeForm();
    await loadProducts();
  }

  function productToPutPayload(product, patch = {}) {
    const qty =
      patch.quantity !== undefined
        ? patch.quantity
        : Math.max(0, Number(product.quantity) || 0);
    return {
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      image: product.image,
      rating: Number(product.rating),
      badge: product.badge ?? "",
      in_stock: patch.in_stock !== undefined ? patch.in_stock : isProductInStock(product),
      quantity: qty,
    };
  }

  /** Зміна наявності для вже існуючого товару (форма «Додати» це не редагує). */
  async function applyProductStockToggle(product) {
    const nextInStock = !isProductInStock(product);
    const payload = productToPutPayload(product, {
      in_stock: nextInStock,
      quantity: Math.max(0, Number(product.quantity) || 0),
    });
    try {
      await api.put(`/products/${product.id}`, payload, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      await loadProducts();
    } catch (err) {
      window.alert(err.response?.data?.message || "Не вдалося оновити наявність");
    }
  }

  async function saveProductQuantity(product) {
    const raw = adminQtyDraft[product.id];
    const q = Math.max(0, Math.floor(Number(raw)) || 0);
    const payload = productToPutPayload(product, { quantity: q });
    try {
      await api.put(`/products/${product.id}`, payload, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      await loadProducts();
    } catch (err) {
      window.alert(err.response?.data?.message || "Не вдалося зберегти кількість");
    }
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("Не вдалося обробити зображення"));
        else resolve(blob);
      }, mimeType, quality);
    });
  }

  async function compressImage(file) {
    const supported = ["image/jpeg", "image/png", "image/webp"];
    const mimeType = supported.includes(file.type) ? file.type : "image/jpeg";

    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      const loaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = src;
      await loaded;

      const maxSide = 1600;
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const quality = mimeType === "image/png" ? 0.92 : 0.82;
      const blob = await canvasToBlob(canvas, mimeType, quality);

      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      return {
        file: new File([blob], `compressed-${Date.now()}.${ext}`, { type: mimeType }),
        compressedBytes: blob.size,
      };
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  async function uploadProductImage(file) {
    if (!file) return;
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    const localPreview = URL.createObjectURL(file);
    setUploadPreview(localPreview);
    try {
      setUploading(true);
      setUploadError("");
      const processed = await compressImage(file);
      setSizeInfo({ original: file.size, compressed: processed.compressedBytes });
      const fd = new FormData();
      fd.append("image", processed.file);
      const res = await api.post("/upload", fd, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setForm((v) => ({ ...v, image: res.data.image }));
    } catch (err) {
      setUploadError(err.response?.data?.message || "Не вдалося завантажити фото");
      URL.revokeObjectURL(localPreview);
      setUploadPreview("");
    } finally {
      setUploading(false);
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadProductImage(file);
  }

  async function deleteProduct(id) {
    await api.delete(`/products/${id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await loadProducts();
  }

  async function createOrder(e) {
    e.preventDefault();
    if (!cart.length) return;
    if (!userToken) {
      setCheckoutStatus("Увійдіть або зареєструйтесь, щоб оформити замовлення.");
      setUserAuthOpen(true);
      setUserAuthTab("login");
      return;
    }
    const payload = { ...checkout, items: cart };
    try {
      const res = await api.post("/orders", payload, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setCheckoutStatus(`Замовлення #${res.data.id} створено. Дякуємо!`);
      setCart([]);
      if (userProfile) {
        setCheckout({
          customer_name: userProfile.name || "",
          phone: userProfile.phone || "",
          city: "",
          comment: "",
        });
      } else {
        setCheckout({ customer_name: "", phone: "", city: "", comment: "" });
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Не вдалося оформити замовлення";
      setCheckoutStatus(msg);
      if (err.response?.status === 401) {
        localStorage.removeItem("user_token");
        setUserToken("");
        setUserProfile(null);
        setUserAuthOpen(true);
      }
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="topbar container">
          <audio ref={musicRef} src={assetUrl(SITE_MUSIC_SRC)} loop preload="none" />
          <div className="brand-with-music">
            <div className="brand" onClick={handleLogoClick}>
              <img src={assetUrl("/images/logo.png")} alt="КЛЯКСА" />
              <strong>КЛЯКСА</strong>
            </div>
            <button
              type="button"
              className={`music-toggle${musicOn ? " music-toggle--on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSiteMusic();
              }}
              aria-pressed={musicOn}
              aria-label={musicOn ? "Вимкнути фонову музику" : "Увімкнути фонову музику"}
            >
              <img src={assetUrl(SITE_MUSIC_ICON)} alt="" width={32} height={32} decoding="async" />
            </button>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost topbar-action-btn" onClick={() => setFavoritesOpen(true)}>
              <Heart size={16} aria-hidden />
              <span>Збережнi</span>
              {favoriteIds.length > 0 && <span className="badge">{favoriteIds.length}</span>}
            </button>
            <button type="button" className="ghost topbar-action-btn" onClick={() => setCartOpen(true)}>
              <ShoppingCart size={16} aria-hidden />
              <span>Кошик</span>
              {cart.length > 0 && <span className="badge">{cart.length}</span>}
            </button>
            {userToken ? (
              <button
                type="button"
                className="ghost topbar-action-btn"
                onClick={() => {
                  setCabinetOpen(true);
                  loadMyOrders();
                }}
                aria-label="Особистий кабінет"
              >
                <User size={16} aria-hidden />
                <span>Кабінет</span>
              </button>
            ) : (
              <button
                type="button"
                className="ghost topbar-action-btn"
                onClick={() => {
                  setUserAuthOpen(true);
                  setUserAuthTab("login");
                  setUserAuthError("");
                }}
                aria-label="Увійти"
              >
                <User size={16} aria-hidden />
                <span>Увійти</span>
              </button>
            )}
          </div>
        </div>

        <div className="container hero-content">
          <h1>Сучасний маркетплейс ігор та творчості</h1>
        </div>
      </header>

      <main className="container">
        <section className="category-row">
          {categories.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "pill active" : "pill"}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
          {isAdmin && (
            <>
              <button
                type="button"
                className={adminOnlyOutOfStock ? "pill admin pill-oos-filter" : "pill admin"}
                onClick={() => setAdminOnlyOutOfStock((v) => !v)}
                title="Показати лише товари поза наявністю"
              >
                Лише відсутні
              </button>
              <button className="pill admin" onClick={openForm}>
                <PlusCircle size={16} /> Додати товар
              </button>
              <button className="pill danger" onClick={adminLogout}>
                <LogOut size={16} /> Вийти з адмінки
              </button>
            </>
          )}
        </section>

        {loading && <p className="empty">Завантаження...</p>}
        {!loading && filteredProducts.length === 0 && (
          <p className="empty">
            {isAdmin && adminOnlyOutOfStock
              ? "У цьому розділі немає товарів поза наявністю — усі в наявності або вимкніть фільтр «Лише відсутні»."
              : "У цьому розділі поки немає товарів. Адмін може додати їх пізніше."}
          </p>
        )}

        <section className="grid">
          {filteredProducts.map((p) => (
            <article key={p.id} className={`card${!isProductInStock(p) ? " card-out" : ""}`}>
              <div className="card-image-wrap">
                {!isProductInStock(p) && (
                  <span className="stock-banner">Немає в наявності</span>
                )}
                <img
                  src={assetUrl(p.image)}
                  alt={p.name}
                  className="card-image"
                  onClick={() => setImagePanel(p)}
                />
                {p.badge && <span className="badge-chip">{p.badge}</span>}
                <button
                  className={favoriteIds.includes(p.id) ? "favorite-btn active" : "favorite-btn"}
                  onClick={() => toggleFavorite(p.id)}
                >
                  <Heart size={14} />
                </button>
                {isAdmin && (
                  <button className="delete-btn" onClick={() => deleteProduct(p.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="card-price-row">
                <span className="card-price">{p.price} грн</span>
                <span className="card-rating">
                  <span className="card-rating-star" aria-hidden>★</span>
                  <span className="card-rating-value">{Number(p.rating).toFixed(1)}</span>
                </span>
              </div>
              {isAdmin && (
                <>
                  <p className="admin-stock-hint">
                    {isProductInStock(p) ? `На складі: ${p.quantity ?? 0} шт.` : "Не в наявності"}
                  </p>
                  <div className="admin-qty-row">
                    <label className="admin-qty-label" htmlFor={`qty-${p.id}`}>
                      Кількість (шт.)
                    </label>
                    <div className="admin-qty-controls">
                      <input
                        id={`qty-${p.id}`}
                        type="number"
                        min="0"
                        step="1"
                        className="admin-qty-input"
                        value={adminQtyDraft[p.id] ?? String(p.quantity ?? 0)}
                        onChange={(e) =>
                          setAdminQtyDraft((d) => ({ ...d, [p.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="admin-qty-save"
                        onClick={() => saveProductQuantity(p)}
                      >
                        Зберегти
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-stock-toggle"
                    onClick={() => applyProductStockToggle(p)}
                  >
                    {isProductInStock(p)
                      ? "Зняти з продажу (немає в наявності)"
                      : "Повернути в наявність"}
                  </button>
                </>
              )}
              <button
                type="button"
                className="buy-btn"
                disabled={!isProductInStock(p)}
                onClick={() => addToCart(p)}
              >
                <ShoppingCart size={16} /> В кошик
              </button>
            </article>
          ))}
        </section>
      </main>

      {imagePanel && (
        <>
          <div className="overlay" onClick={() => setImagePanel(null)} />
          <aside className="side-panel">
            <button className="close" onClick={() => setImagePanel(null)}><X size={18} /></button>
            <img src={assetUrl(imagePanel.image)} alt={imagePanel.name} className="panel-image" />
            <h3>{imagePanel.name}</h3>
            <p>{imagePanel.description}</p>
            <b>{imagePanel.price} грн</b>
          </aside>
        </>
      )}

      {cartOpen && (
        <>
          <div className="overlay" onClick={() => setCartOpen(false)} />
          <aside className="cart-panel">
            <button className="close" onClick={() => setCartOpen(false)}><X size={18} /></button>
            <h3>Кошик</h3>
            {cart.length === 0 && <p className="empty">Кошик порожній.</p>}
            {cart.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={assetUrl(item.image)} alt={item.name} />
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.qty} x {item.price} грн</p>
                </div>
                <button onClick={() => removeFromCart(item.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="total">Разом: <b>{total} грн</b></div>
            {!userToken ? (
              <div className="checkout-gate">
                <p className="empty">
                  Оформлення замовлення доступне лише для зареєстрованих користувачів. Увійдіть або створіть акаунт.
                </p>
                <button
                  className="buy-btn"
                  type="button"
                  onClick={() => {
                    setUserAuthOpen(true);
                    setUserAuthTab("login");
                    setUserAuthError("");
                  }}
                >
                  Увійти / Реєстрація
                </button>
              </div>
            ) : (
              <form className="checkout" onSubmit={createOrder}>
                <input placeholder="Ім'я" value={checkout.customer_name} onChange={(e) => setCheckout((v) => ({ ...v, customer_name: e.target.value }))} required />
                <input placeholder="Телефон" value={checkout.phone} onChange={(e) => setCheckout((v) => ({ ...v, phone: e.target.value }))} required />
                <input placeholder="Місто" value={checkout.city} onChange={(e) => setCheckout((v) => ({ ...v, city: e.target.value }))} required />
                <input placeholder="Коментар" value={checkout.comment} onChange={(e) => setCheckout((v) => ({ ...v, comment: e.target.value }))} />
                <button className="buy-btn" type="submit">Оформити замовлення</button>
                {checkoutStatus && (
                  <p className={checkoutStatus.startsWith("Замовлення") ? "ok" : "error"}>{checkoutStatus}</p>
                )}
              </form>
            )}
          </aside>
        </>
      )}

      {favoritesOpen && (
        <>
          <div className="overlay" onClick={() => setFavoritesOpen(false)} />
          <aside className="cart-panel">
            <button className="close" onClick={() => setFavoritesOpen(false)}><X size={18} /></button>
            <h3>Збережені товари</h3>
            {favoriteProducts.length === 0 && <p className="empty">Поки що немає збережених товарів.</p>}
            {favoriteProducts.map((item) => (
              <div key={item.id} className="cart-item">
                <img src={assetUrl(item.image)} alt={item.name} />
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.price} грн</p>
                </div>
                <button onClick={() => toggleFavorite(item.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            {favoriteProducts.length > 0 && (
              <button
                className="buy-btn"
                type="button"
                onClick={() => {
                  favoriteProducts.filter(isProductInStock).forEach(addToCart);
                  setFavoritesOpen(false);
                }}
              >
                <ShoppingCart size={16} /> Додати доступні в кошик
              </button>
            )}
          </aside>
        </>
      )}

      {userAuthOpen && (
        <>
          <div
            className="overlay"
            onClick={() => {
              setUserAuthOpen(false);
              setUserAuthError("");
            }}
          />
          <aside className="auth-panel user-auth-panel">
            <button
              className="close"
              type="button"
              onClick={() => {
                setUserAuthOpen(false);
                setUserAuthError("");
              }}
            >
              <X size={18} />
            </button>
            <User size={26} />
            <h3>Обліковий запис</h3>
            <div className="auth-tabs">
              <button
                type="button"
                className={userAuthTab === "login" ? "auth-tab active" : "auth-tab"}
                onClick={() => {
                  setUserAuthTab("login");
                  setUserAuthError("");
                }}
              >
                Вхід
              </button>
              <button
                type="button"
                className={userAuthTab === "register" ? "auth-tab active" : "auth-tab"}
                onClick={() => {
                  setUserAuthTab("register");
                  setUserAuthError("");
                }}
              >
                Реєстрація
              </button>
            </div>
            {userAuthTab === "login" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performUserLogin();
                }}
              >
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={userLogin.email}
                  onChange={(e) => {
                    setUserLogin((v) => ({ ...v, email: e.target.value }));
                    setUserAuthError("");
                  }}
                  required
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Пароль"
                  value={userLogin.password}
                  onChange={(e) => {
                    setUserLogin((v) => ({ ...v, password: e.target.value }));
                    setUserAuthError("");
                  }}
                  required
                />
                <button className="buy-btn" type="submit">
                  Увійти
                </button>
                {userAuthError && <p className="error">{userAuthError}</p>}
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performUserRegister();
                }}
              >
                <input
                  type="text"
                  placeholder="Ім'я"
                  value={userRegister.name}
                  onChange={(e) => {
                    setUserRegister((v) => ({ ...v, name: e.target.value }));
                    setUserAuthError("");
                  }}
                  required
                />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={userRegister.email}
                  onChange={(e) => {
                    setUserRegister((v) => ({ ...v, email: e.target.value }));
                    setUserAuthError("");
                  }}
                  required
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Пароль (мін. 6 символів)"
                  value={userRegister.password}
                  onChange={(e) => {
                    setUserRegister((v) => ({ ...v, password: e.target.value }));
                    setUserAuthError("");
                  }}
                  minLength={6}
                  required
                />
                <button className="buy-btn" type="submit">
                  Зареєструватися
                </button>
                {userAuthError && <p className="error">{userAuthError}</p>}
              </form>
            )}
          </aside>
        </>
      )}

      {cabinetOpen && userToken && (
        <>
          <div className="overlay" onClick={() => setCabinetOpen(false)} />
          <aside className="cart-panel cabinet-panel">
            <button className="close" type="button" onClick={() => setCabinetOpen(false)}>
              <X size={18} />
            </button>
            <h3>Особистий кабінет</h3>
            {!userProfile ? (
              <p className="empty">Завантаження профілю…</p>
            ) : (
              <>
                <p className="cabinet-email">{userProfile.email}</p>
                <form className="cabinet-profile" onSubmit={saveProfile}>
                  <label>
                    {"Ім'я"}
                    <input
                      value={profileEdit.name}
                      onChange={(e) => setProfileEdit((v) => ({ ...v, name: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Телефон
                    <input
                      value={profileEdit.phone}
                      onChange={(e) => setProfileEdit((v) => ({ ...v, phone: e.target.value }))}
                      placeholder="+380..."
                    />
                  </label>
                  <button className="buy-btn" type="submit" disabled={profileSaving}>
                    {profileSaving ? "Збереження…" : "Зберегти профіль"}
                  </button>
                </form>
              </>
            )}
            <h4>Мої замовлення</h4>
            {myOrders.length === 0 && (
              <p className="empty">Поки немає замовлень, оформлених під цим акаунтом.</p>
            )}
            {myOrders.map((o) => (
              <div key={o.id} className="order-card">
                <div className="order-card-head">
                  <strong>#{o.id}</strong>
                  <span className="order-status">{orderStatusLabel(o.status)}</span>
                </div>
                <p className="order-meta">
                  {o.total} грн · {new Date(o.created_at).toLocaleString("uk-UA")}
                </p>
              </div>
            ))}
            <button className="ghost secondary cabinet-logout" type="button" onClick={userLogout}>
              <LogOut size={16} /> Вийти з акаунта
            </button>
          </aside>
        </>
      )}

      {authOpen && (
        <>
          <div className="overlay" onClick={() => setAuthOpen(false)} />
          <aside className="auth-panel">
            <Shield size={26} />
            <h3>Вхід адміністратора</h3>
            <form onSubmit={adminLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError("");
                }}
                onPaste={() => setAuthError("")}
                placeholder="Пароль"
                required
              />
              <button className="buy-btn" type="submit">Увійти</button>
              <button className="ghost secondary" type="button" onClick={pasteAndLogin}>
                Вставити з буфера та увійти
              </button>
              {authError && <p className="error">{authError}</p>}
            </form>
          </aside>
        </>
      )}

      {formOpen && (
        <>
          <div className="overlay" onClick={closeForm} />
          <aside className="auth-panel">
            <h3>Додати товар</h3>
            <form onSubmit={saveProduct}>
              <input placeholder="Назва" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required />
              <input placeholder="Опис" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} required />
              <input type="number" placeholder="Ціна" value={form.price} onChange={(e) => setForm((v) => ({ ...v, price: e.target.value }))} required />
              <select value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}>
                {categories.filter((c) => c.id !== "all").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <label
                className={dragActive ? "dropzone active" : "dropzone"}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadProductImage(e.target.files?.[0])}
                  hidden
                />
                <span>Перетягніть фото сюди або натисніть для вибору</span>
              </label>
              {uploading && <p className="empty">Завантаження фото...</p>}
              {uploadError && <p className="error">{uploadError}</p>}
              {(sizeInfo.original > 0 || sizeInfo.compressed > 0) && (
                <p className="size-info">
                  Було: <b>{formatBytes(sizeInfo.original)}</b> → Стало: <b>{formatBytes(sizeInfo.compressed)}</b>
                </p>
              )}
              {(uploadPreview || form.image) && (
                <div className="upload-preview">
                  <img src={uploadPreview || assetUrl(form.image)} alt="Прев'ю товару" />
                </div>
              )}
              <input placeholder="Шлях до фото (/images/...)" value={form.image} onChange={(e) => setForm((v) => ({ ...v, image: e.target.value }))} required />
              <input type="number" step="0.1" min="1" max="5" placeholder="Рейтинг" value={form.rating} onChange={(e) => setForm((v) => ({ ...v, rating: e.target.value }))} />
              <input placeholder="Бейдж (NEW, ХІТ, -15%)" value={form.badge} onChange={(e) => setForm((v) => ({ ...v, badge: e.target.value }))} />
              <label className="toggle-row">
                <span className="toggle-label">
                  {form.in_stock ? "В наявності" : "Немає в наявності"}
                </span>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={form.in_stock}
                    onChange={(e) => setForm((v) => ({ ...v, in_stock: e.target.checked }))}
                  />
                  <span className="toggle-slider" aria-hidden />
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Кількість на складі (шт.)"
                value={form.quantity}
                onChange={(e) => setForm((v) => ({ ...v, quantity: e.target.value }))}
              />
              <button className="buy-btn" type="submit">Зберегти</button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
