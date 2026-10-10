# LearnMap

Platform eksperimen **Kit-Build Concept Map** untuk penelitian skripsi: **membandingkan dua model segmentasi peta konsep**

## Fokus Penelitian

| Model | Deskripsi |
| --- | --- |
| **A — Segmentasi Paragraf** | Peta konsep dibagi mengikuti struktur paragraf materi pembelajaran. Setiap konsep ditandai nomor paragrafnya; simpul link mengikuti paragraf konsep tujuannya. |
| **B — Segmentasi Depth Topik** | Peta konsep dibagi berdasarkan kedalaman hierarki topik: konsep umum (akar) → konsep yang lebih spesifik, satu segmen per level kedalaman. |

Landasan teori: **Segmenting Principle (Mayer)** yang dioperasikan pada peta konsep menurut **Schneider et al. (2021)** — segmentasi yang bermakna dan koheren dapat mengurangi beban kognitif dan meningkatkan hasil belajar.

## Pengukuran (sesuai batasan penelitian)

Yang diukur:

1. **Pretest** — pilihan ganda, dinilai otomatis.
2. **Posttest** — pilihan ganda, dinilai otomatis.
3. **Map Score** — kesesuaian Learner Map dengan Goal Map (diagnosis otomatis proposisi konsep–link–konsep, cocok via label).
4. **Waktu Pengerjaan** — durasi tiap fase dicatat server (pretest, membaca materi, membangun peta, posttest, kuesioner).
5. **Kuesioner** — persepsi siswa, skala Likert 1–5.

Yang **tidak** digunakan:

- Sub-Map Scoring (SMS)
- Analisis urutan pengerjaan

## Alur Siswa

```
Pretest → Baca Materi → Bangun Peta (kit per segmen) → Posttest → Kuesioner
```

- Kelompok (A/B) ditetapkan otomatis secara seimbang saat siswa memulai sesi.
- Kit disajikan bertahap per segmen; siswa menyusun relasi **Konsep → Link → Konsep** (sambungan lain ditolak editor).
- Batas waktu membangun peta dapat diatur per eksperimen; auto-submit saat waktu habis.
- Draf peta tersimpan otomatis; diagnosis dihitung saat submit.

## Alur Peneliti

1. **Materi** — tulis materi, paragraf dipisah baris kosong.
2. **Goal Map** — editor canvas: tambah konsep/link, tandai paragraf tiap konsep, sambungkan relasi, pratinjau hasil kedua model segmentasi sebelum dipakai.
3. **Eksperimen** — pilih goal map, tulis soal pretest/posttest (`pertanyaan | opsiA | opsiB | ... | kunci` satu baris per soal) dan butir kuesioner, atur batas waktu.
4. **Hasil** — ringkasan per kelompok (rata-rata pretest, posttest, map score, waktu, gain) + tabel per partisipan + **ekspor CSV** untuk analisis statistik.

## Tech Stack

- **Frontend**: React 19 + TypeScript, TanStack Router + React Query, XYFlow (canvas peta konsep), Tailwind CSS 4, Vite.
- **Backend**: Hono (Node), SQLite via Drizzle ORM + libsql.
- **Engine riset** (`src/server/lib/`):
  - `segmentation.ts` — dua model segmentasi + validasi cakupan simpul.
  - `comparator.ts` — diagnosis peta (proposisi tripel, cocok via label, dedupe, score = benar/total).

## Menjalankan

```bash
npm install
npm run db:migrate     # buat tabel
npm run db:seed        # data contoh + akun
npm run dev            # API di :3210 + web di :5199
```

Akun contoh (dari seed):

| Role | Username | Password |
| --- | --- | --- |
| Peneliti | `peneliti` | `peneliti123` |
| Siswa | `siswa1` … `siswa3` | `siswa123` |

Perintah lain: `npm test` (unit test engine segmentasi & comparator), `npm run typecheck`, `npm run build` (frontend), `npm run db:reset` (hapus + migrasi + seed ulang).

## Struktur

```
src/
├── shared/types.ts            # tipe domain bersama
├── server/
│   ├── lib/
│   │   ├── segmentation.ts    # engine 2 model segmentasi
│   │   ├── comparator.ts      # map scoring (diagnosis KitBuild)
│   │   └── auth.ts            # session + hash password
│   ├── db/                    # schema Drizzle + migrasi
│   └── routes/                # auth, catalog, experiments, participations, results
├── features/                  # UI per domain (auth, material, goal-map, experiment, session)
└── components/                # shell + primitives UI
scripts/seed.ts                # data contoh riset
drizzle/                       # migrasi SQL
```

## Catatan Implementasi Segmentasi

- **Paragraf**: konsep wajib ditandai nomor paragraf (dieditor goal map). Link mengikuti paragraf konsep tujuan sehingga proposisi selesai pada segmen tempat konsep kedua dibahas; sisi lintas segmen tidak ikut kit mana pun.
- **Depth**: kedalaman dihitung via BFS dari akar (konsep tanpa jalur masuk); link mengikuti kedalaman terkecil konsep tetangganya. Struktur siklik/terputus masuk segmen akhir.
- Kedua engine menjamin setiap simpul masuk tepat satu segmen (divalidasi + unit test).
