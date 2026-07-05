# AriseHash — Design System

Tema: **"Editorial Flat / Neo-Brutalist Lembut"** — latar krem hangat, garis tegas tipis, aksen indigo + lime, tipografi display kapital, datar tanpa gradient. Cocok untuk marketplace, SaaS, landing page, dashboard.

---

## 1. Prinsip (aturan utama)
1. **Flat total — TANPA gradient** di mana pun (warna solid saja).
2. **TANPA emoji** — pakai ikon garis (lucide-react) & motif SVG (asterisk/sparkle).
3. **Garis tegas tipis 1.5px** warna ink di kartu, pill, input (look "bordered").
4. **Radius besar** (14–28px) — lembut tapi tetap tegas.
5. **Tipografi display KAPITAL** untuk heading (Space Grotesk), body normal (Inter).
6. **Aksen hemat**: lime hanya untuk highlight/CTA kecil; indigo untuk aksi utama.
7. **Animasi halus**: hover lift, scroll-reveal, page transition (framer-motion).
8. **Hangat & netral**: latar krem `#efece6`, bukan putih dingin.

---

## 2. Warna (design tokens)
```css
:root {
  /* Latar & permukaan */
  --bg: #efece6;        /* krem hangat — latar utama */
  --bg-2: #e7e3da;      /* krem lebih gelap */
  --surface: #ffffff;   /* kartu */
  --surface-2: #f6f4ef; /* kartu/chip sekunder */

  /* Teks */
  --ink: #2b2b28;       /* charcoal — teks & garis utama */
  --ink-soft: #57564f;  /* teks sekunder */
  --muted: #8a887e;     /* teks redup */

  /* Garis */
  --line: #2b2b28;      /* border tegas */
  --line-soft: #d8d4c9; /* border halus / pemisah */

  /* Aksen */
  --indigo: #4f46e5;      /* aksi utama (CTA, link, harga) */
  --indigo-ink: #3a32c2;  /* hover indigo */
  --lime: #c5f82a;        /* highlight/chip/ikon kecil */
  --lime-deep: #b2e617;   /* lime hover/bintang */
}
```
**Rasio pemakaian:** ±70% krem/putih, 20% ink (teks/garis), 8% indigo, 2% lime. Lime = bumbu, jangan dominan.

## 3. Bentuk & bayangan
```css
--radius-sm: 14px;   /* input, chip, tombol kecil */
--radius: 20px;      /* kartu */
--radius-lg: 28px;   /* panel/banner besar */
/* Pill (tombol bulat penuh) = border-radius: 999px */
--shadow:      0 1px 0 rgba(43,43,40,.04), 0 10px 30px -18px rgba(43,43,40,.45);
--shadow-lift: 0 18px 44px -22px rgba(43,43,40,.55);  /* saat hover/menu */
```

## 4. Tipografi
```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
```
```css
--font-display: 'Space Grotesk', system-ui, sans-serif; /* heading, harga, angka */
--font-body: 'Inter', system-ui, sans-serif;            /* teks biasa */
```
- **Display** (`.display`): Space Grotesk, `font-weight:700`, `text-transform:uppercase`, `letter-spacing:-0.01em`, `line-height:1.02`.
- **Ukuran responsif** (clamp): H-XL `clamp(2rem,7vw,4.6rem)` · H-LG `clamp(1.6rem,5.5vw,3rem)` · H-MD `clamp(1.3rem,4.5vw,2rem)`.
- **Eyebrow** (label kecil di atas heading): Space Grotesk, `13px`, `weight:600`, `letter-spacing:.16em`, `uppercase`, warna `--ink-soft`.
- Body: Inter, `line-height:1.5`.

## 5. Komponen kunci

**Pill / tombol** (ciri khas — bulat penuh + ikon panah di lingkaran lime)
```css
.pill { display:inline-flex; align-items:center; gap:10px; padding:11px 18px;
  border-radius:999px; border:1.5px solid var(--line); font-weight:600; font-size:15px;
  background:transparent; color:var(--ink); transition:.2s; }
.pill:hover { transform:translateY(-2px); }
.pill-indigo { background:var(--indigo); color:#fff; border-color:var(--indigo); }
.pill-solid  { background:var(--ink); color:#fff; border-color:var(--ink); }
.pill .pill-ic { display:grid; place-items:center; width:26px; height:26px;
  border-radius:999px; background:var(--lime); color:var(--ink); } /* lingkaran ikon panah */
```

**Kartu**
```css
.card { background:var(--surface); border:1.5px solid var(--line);
  border-radius:20px; box-shadow:var(--shadow); }
/* hover: transform:translateY(-3px) + border jadi accent */
```

**Chip / badge**
```css
.chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600;
  letter-spacing:.04em; text-transform:uppercase; padding:6px 11px; border-radius:999px;
  border:1.5px solid var(--line); background:var(--surface-2); }
.chip-lime { background:var(--lime); border-color:var(--ink); }
```

**Input**
```css
.input { width:100%; padding:14px 16px; border:1.5px solid var(--line);
  border-radius:14px; background:var(--surface); font-size:15px; color:var(--ink); }
.input:focus { outline:3px solid rgba(79,70,229,.25); border-color:var(--indigo); }
```

**Link garis-bawah** (`.btn-link`): underline 2px ink, `gap` melebar saat hover.

## 6. Motif & dekorasi (pengganti emoji)
- **Asterisk** ✳ — bintang 8-arah (SVG stroke), motif tanda khas brand. Bisa berputar pelan (`spin`).
- **Sparkle** ✦ — bintang 4-arah isi lime.
- **Marquee** — baris brand/teks berjalan horizontal (animasi `marquee`).
- Ikon UI: **lucide-react** (garis, strokeWidth ~2.2).

## 7. Layout & gerak
- Container max-width **1200px**, padding `0 24px`. Section padding `84px 0`.
- Grid produk: `repeat(auto-fill, minmax(270px, 1fr))`, gap 22px.
- **framer-motion**: page transition (fade/slide antar route), `whileInView` scroll-reveal (opacity+y), hover `whileHover={{y:-6}}`, `whileTap={{scale:.96}}`.
- Hormati `prefers-reduced-motion` (matikan animasi).

## 8. Stack
React 18 + Vite · CSS variables di satu `index.css` (tanpa Tailwind) · framer-motion · lucide-react · Space Grotesk + Inter.

---

### Cara terapkan ke project lain (cepat)
1. Salin blok `:root` (warna + radius + shadow + font) ke `index.css`.
2. Tambah `<link>` Google Fonts di `index.html`.
3. Salin util class: `.display .eyebrow .pill .pill-indigo .card .chip .input .btn-link`.
4. Set `body { background:var(--bg); color:var(--ink); font-family:var(--font-body); }`.
5. Patuhi 8 prinsip di atas (terutama: **no gradient, no emoji, border 1.5px, heading kapital**).
