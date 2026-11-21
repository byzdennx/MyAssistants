# MyAssistants

> *Your quiet companion for thinking.*

Website AI chat bernama **MyAssistants** bergaya **vintage glassmorphism**: krem hangat, tinta sepia, kaca buram, grain kertas.
Dibuat oleh **EpannXD**. Tanpa login, tanpa paket berbayar, semua data tersimpan di `localStorage`.

| Halaman | Isi |
| --- | --- |
| `/` | Sapaan sesuai waktu, statistik (percakapan, pesan, file, streak, kuota), percakapan terakhir |
| `/chat`, `/chat/:id` | Ngobrol santai. Pilihan model (teks) di header. Permintaan code dialihkan ke Coder |
| `/vision`, `/vision/:id` | **Tanya gambar**: upload PNG/JPEG/WebP/GIF atau URL, hanya model `supportsVision`, tampil `usage` + `x-request-id`. **Alat gambar** (Nekolabs): restore, enhance, hapus latar dari URL gambar |
| `/coder`, `/coder/:id` | Mode code — hasil generate **auto-tersimpan ke File Manager**; bubble hanya menampilkan daftar "membuat file …" |
| `/files` | File Manager: proyek, tree view, editor bernomor baris (khusus PC), **Teleprinter** (terminal AI), ekspor ZIP/JSON |
| `/profile/:tab` | `settings` · `manager` · `danger` |

Stack: Vite + React + Tailwind CSS · `marked` + `DOMPurify` + `highlight.js` · `jszip` · Vercel Serverless Functions di `/api`.

---

## Setup lokal

```bash
npm install
cp .env.example .env        # isi NEKOLABS_API_KEY, OPENROUTER_API_KEY, CHEAPLLM_API_KEY, KENARI_API_KEY
npm i -g vercel
vercel dev                  # frontend + /api/chat + /api/image + /api/models dalam satu server
```

Tanpa env key, buka `/profile/manager?dev=1` dan aktifkan **Respons tiruan (dev only)** untuk mencoba UI.

**Aturan keamanan API key:** seluruh request ke provider lewat proxy server (`/api/chat`, `/api/image`, `/api/models`) dan key hanya dibaca dari `process.env` di server. Tidak ada input key di UI dan tidak ada key di localStorage/browser.

## Deploy ke Vercel

1. Push repo ke GitHub → **Add New → Project** di Vercel → pilih repo ini (framework terdeteksi sebagai Vite).
2. **Settings → Environment Variables** → tambahkan `NEKOLABS_API_KEY`, `OPENROUTER_API_KEY`, `CHEAPLLM_API_KEY`, dan `KENARI_API_KEY` (provider tanpa key hanya menonaktifkan modelnya sendiri).
3. Deploy. `vercel.json` berisi: SPA fallback (`/((?!api/).*)` → `/index.html`) supaya refresh di `/chat/abc` tidak 404, serta `maxDuration: 300` untuk `/api/chat` (streaming model besar bisa lama).

`api/chat.js` meneruskan SSE apa adanya saat `stream:true` dan selalu mengembalikan header `X-Request-Id`.

## Provider & model (single source of truth)

Semua ada di `src/config/providers.js` (dipakai server dan client):

| Provider | Base URL | Env key | Jenis API | Model |
| --- | --- | --- | --- | --- |
| **Nekolabs** | `https://nekolabs.my.id/v1` | `NEKOLABS_API_KEY` | `GET` + header `X-API-Key` | `claude`, `beam`, `gemma`, `vision` + alat gambar |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | OpenAI-compatible | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| **CheapLLM** | `https://cheapllm.shop/v1` | `CHEAPLLM_API_KEY` | OpenAI-compatible | `deepseek-v4.1-flash-1017` (context 131.072) |
| **Kenari** | `https://kenari.id/v1` | `KENARI_API_KEY` | OpenAI-compatible | 24 model `:free` |

Default: **Chat** `nekolabs:claude`, **Coder & Teleprinter** `openrouter:nvidia/nemotron-3-ultra-550b-a55b:free`, **Vision** `kenari:glm-4-6v-flash:free`. Semuanya bisa diganti lewat dropdown di header halaman.

**Nekolabs** bukan OpenAI-compatible, jadi `api/chat.js` menerjemahkannya:
- `claude` / `beam` / `gemma` → `GET /ai/<model>?content=…`. Riwayat dan instruksi digabung menjadi satu teks (maks ±12.000 karakter ter-encode; lebih dari itu `413 too_long`). Hanya `claude` yang ikut mengirim `conversationId`, `deviceId`, `needSearch` (toggle **Cari di web**).
- `vision` → `GET /image/vision?url=…&q=…`. Hanya menerima **URL gambar https**; unggahan dimatikan untuk model ini.
- Jawaban dibungkus ke bentuk OpenAI (`choices[0].message.content`), dan bila diminta `stream` dikirim sebagai satu chunk SSE, sehingga client memakai satu parser untuk semua provider.
- Nama parameter `content` untuk `beam` dan `gemma` mengikuti `claude`. Kalau berbeda, set `queryParam` pada model di registry. Bentuk JSON respons dibaca toleran (`result`, `result.text`, `data`, …).

**Alat gambar** (`POST /api/image` → `{ url, requestId }`): `restore` (`upscale`), `enhance` (`upscale`, `background`), `rembg`. Server meneruskan ke `GET /image/<alat>?url=…`; hasil boleh berupa JSON berisi URL atau gambar langsung (dikembalikan sebagai data URL). Pilihan `upscale` ada di `UPSCALE_VALUES`.

Setiap model punya flag `supportsVision`. Halaman `/vision` hanya menampilkan model vision; Chat/Coder hanya model teks. Server juga memvalidasi: `vision:true` dengan model non-vision → `400 model_not_vision`.

Streaming SSE dipakai di Chat, Coder, dan Vision untuk provider OpenAI-compatible; Teleprinter non-stream. `usage` dan `x-request-id` disimpan di `message.meta` dan ditampilkan di halaman Vision.

### Auto-save Coder → File Manager

Setiap balasan Coder yang mengandung code:
1. dipecah menjadi file dari blok kode Markdown. Untuk menentukan nama file, minta komentar path seperti `// src/App.jsx`; blok tanpa nama disimpan sebagai `snippet-N`,
2. **otomatis tersimpan** ke proyek yang terikat pada percakapan (dibuat otomatis dari judul percakapan kalau belum ada),
3. bubble di `/coder` **tidak menampilkan kode** — hanya penjelasan + baris `✓ membuat file <path>` dan tombol "Buka di Files".

## Teleprinter (terminal AI di `/files`)

Terminal ala CLI di bawah editor File Manager, terhubung ke model yang sama dengan Coder:
- Perintah lokal: `help`, `clear`, `ls`, `new <path>`; selain itu dikirim ke model sebagai request coding.
- Model menerima konteks proyek (daftar file + isi file aktif) sehingga bisa menambah/mengubah file yang sudah ada.
- Hasil generate otomatis tersimpan ke proyek aktif; terminal mencetak `✓ membuat file <path> (ukuran)`.
- Riwayat perintah dengan ↑/↓.
- **Ingatan per proyek**: 40 giliran terakhir (permintaan + ringkasan balasan tanpa kode) disimpan di localStorage dan dikirim ulang tiap request. File yang ditulis giliran terakhir dan file aktif ikut sebagai konteks, sehingga bisa diubah lanjut. `forget` menghapus ingatan, `clear` hanya membersihkan layar.

## File Manager

- Disimpan di `localStorage` key `myassistant_files` dengan bentuk `{ projects: [{ id, name, createdAt, updatedAt, files: [{ path, content, updatedAt }] }] }`.
- **Batas 250 MB per proyek dan per percakapan** (`MAX_ENTITY_BYTES`) — dicegah di create/update/save/impor.
- Coder menyimpan otomatis (lihat atas).
- API: `saveFileToProject({ projectName, path, content })` di `src/lib/files.js` — proyek dibuat otomatis kalau belum ada.
- Editor (khusus layar ≥ 768px): autosave 500 ms, `Ctrl/Cmd + S`, Tab = 2 spasi, salin, unduh per file.
- **Di HP hanya daftar file & folder** — editor dan Teleprinter disembunyikan; mengetuk file menampilkan catatan.
- Ekspor proyek ke `.zip` (JSZip) atau `.json`; ekspor semua file; impor `.json` (divalidasi).
- **Preview HTML** (tombol Preview saat proyek punya `.html`, layar lebar): halaman dirender di iframe sandbox. `<link rel="stylesheet">` dan `<script src>` lokal digabung dari file proyek (path relatif terhadap halaman). Link lokal ke halaman lain bisa diklik. Referensi yang tidak ada dilaporkan di atas preview. JSX/TS dan gambar lokal belum didukung.

## Cara kerja lain

| Hal | Detail |
| --- | --- |
| Rate limit | Semua mode (Chat, Vision, Alat gambar, Coder, Teleprinter): 5 prompt / 24 jam / device karena semua memakai key server. Data: `{ timestamps: [...] }`. Request gagal mengembalikan jatah. |
| Reset kuota | **Reset Quota (dev only)** di `/profile/manager?dev=1`. |
| Device ID | `crypto.randomUUID()` di localStorage, dikirim ke API. |
| Penjaga mode | Chat menolak permintaan code; Coder mengalihkan obrolan santai ke Chat (balasan lokal, tanpa API & tanpa memotong kuota). |
| API key | Hanya di env server (`NEKOLABS_API_KEY`, `OPENROUTER_API_KEY`, `CHEAPLLM_API_KEY`, `KENARI_API_KEY`); semua request lewat `/api/chat` dan `/api/image`. Tidak ada key di client. |
| Ekspor semua data | Percakapan, pengaturan, aktivitas, dan File Manager dalam satu JSON (API key tidak ikut). |
| Factory reset | Menghapus semuanya termasuk file, **kecuali** hitungan kuota harian. |

> Format respons Nekolabs dibaca toleran (`result`, `result.text`, `data`, …).
> Kalau bentuk JSON-nya berbeda, sesuaikan `TEXT_PATHS` di `api/chat.js`.

## Shortcut

| Tombol | Aksi |
| --- | --- |
| `Ctrl/Cmd + K` | Percakapan baru |
| `Enter` / `Ctrl/Cmd + Enter` | Kirim pesan (`Shift + Enter` = baris baru) |
| `Ctrl/Cmd + S` | Simpan file (File Manager) |
| `Esc` | Tutup modal / laci |

## Struktur

```
api/chat.js              Proxy chat & vision semua provider (SSE, usage, x-request-id, validasi vision)
api/image.js             Proxy alat gambar Nekolabs (restore, enhance, rembg)
api/models.js            Daftar provider/model + status env key
vercel.json              SPA fallback + maxDuration function — wajib untuk clean URL
src/
  main.jsx, App.jsx      entry & shell (App.tsx hanya me-re-export App.jsx)
  router.jsx             router History API (pushState/popstate, <A href>)
  config/providers.js    Registry provider, model, dan alat gambar (id, label, supportsVision, …)
  prompts.js             Instruksi bawaan Chat dan balasan pengalihan mode
  lib/                   storage, files, rateLimit, api (proxy + SSE), markdown,
                         exportImport, preview, i18n, intent, hooks, engines
  components/            GlassCard, VintageDivider, ChatBubble, CodeBlock, FileTree,
                         Terminal, HtmlPreview, SaveFilesModal, QuotaModal, Toast, ConfirmModal, Layout, ...
  pages/                 Home, Chat, Vision, Coder, Files, Profile
  styles/globals.css     Tailwind + tema + utilitas kaca/noise
public/noise.svg         tekstur grain kertas
tailwind.config.js       palet & font (dimuat lewat @config di globals.css)
```

Template proyek ini memakai `vite.config.ts` (React + Tailwind + single-file build); tidak perlu konfigurasi
`base` khusus untuk clean URL.

## Catatan desain

Palet: krem `#F4EDE4` / `#EDE4D3`, tinta `#2B2118` / `#3D2E22`, terakota `#B8654A`, sage `#7A8B6F`, emas `#C9A961`.
Font: Instrument Serif & Fraunces (judul), IBM Plex Sans (isi), JetBrains Mono (kode).
Radius 2–8px, animasi hanya fade + slide 200 ms, latar berupa bentuk statis. Tema: terang, sepia, gelap.

© 2026 EpannXD
