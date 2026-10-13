# Demo Fotosintesis — Bahan Konsultasi Dosen Pembimbing

Demo ini menunjukkan **fokus penelitian skripsi** secara langsung di platform LearnMap:
membandingkan **dua model segmentasi** pada Kit-Build Concept Map (bukan memberikan rekomendasi).

---

## 1. Rumusan yang didemokan

> Model segmentasi mana yang lebih efektif pada Kit-Build Concept Map:
> **Segmen berdasarkan Paragraf** atau **Segmen berdasarkan Depth Topik**?

- **Teori dasar**: Schneider et al. (2021) menerapkan _Segmenting Principle_ (Mayer) pada peta
  konsep — segmentasi yang bermakna dan koheren menurunkan beban kognitif dan meningkatkan
  hasil belajar.
- **Desain**: satu goal map yang SAMA, dua partisi BERBEDA (bukan dua map berbeda), sehingga
  yang dibandingkan murni cara memotong, bukan isinya.
- **Pengukuran**: pretest, posttest, map score (diagnosis otomatis), waktu pengerjaan,
  kuesioner persepsi. **Tanpa** Sub-Map Scoring dan **tanpa** analisis urutan.

## 2. Materi & Goal Map

- **Topik**: Fotosintesis (Biologi SMA) — 4 paragraf: (1) pengertian & letak, (2) syarat,
  (3) proses reaksi terang/gelap, (4) hasil & manfaat.
- **Goal map**: 13 konsep + 14 proposisi (konsep–kata penghubung–konsep), misalnya
  _Kloroplas —mengandung→ Klorofil_, _Reaksi Terang —menghasilkan→ Oksigen_.

## 3. Dua model segmentasi (treatment)

|                   | Kelompok A — Segmen Paragraf          | Kelompok B — Segmen Depth Topik            |
| ----------------- | ------------------------------------- | ------------------------------------------ |
| Sumber potongan   | Struktur paragraf teks bacaan         | Kedalaman hierarki topik (umum → spesifik) |
| Segmen 1 (merah)  | P1: pengertian & letak (3 proposisi)  | Level 0–1: konsep inti (4 proposisi)       |
| Segmen 2 (kuning) | P2: syarat fotosintesis (4 proposisi) | Level 2: konsep menengah (4 proposisi)     |
| Segmen 3 (biru)   | P3: proses (4 proposisi)              | Level 3: konsep rincian (4 proposisi)      |
| Segmen 4 (hijau)  | P4: hasil (3 proposisi)               | Level 4: paling spesifik (2 proposisi)     |
| Total             | 14 proposisi                          | 14 proposisi                               |

- Jumlah proposisi kedua kelompok **sama (14)** — kontrol beban target.
- Warna node pada kit memvisualisasikan segmen: **merah/kuning/biru/hijau**.
- Segmen disusun **berurutan** (siswa menyelesaikan satu segmen, baru berikutnya) sesuai
  Segmenting Principle; semua segmen dibangun ke **satu learner map yang sama** sehingga
  map score akhir tetap diukut utuh tanpa Sub-Map Scoring.

## 4. Akun demo

| Peran            | Akun                 | Password  | Keterangan                   |
| ---------------- | -------------------- | --------- | ---------------------------- |
| Peneliti/guru    | alex@kitbuild.mail   | alex12345 | Pemilik materi & assignment  |
| Siswa Kelompok A | sari@kitbuild.mail   | demo12345 | experiment — Segmen Paragraf |
| Siswa Kelompok B | rudi@kitbuild.mail   | demo12345 | control — Segmen Depth Topik |
| Siswa (demo JP)  | tanaka@kitbuild.mail | demo12345 | Data demo bawaan             |

- Sari hanya melihat **Kelompok A**, Rudi hanya melihat **Kelompok B** (target per-user,
  dikunci server — pratinjau mekanisme randomisasi riset).
- Keduanya sudah punya data: pre-test, learner map terkirim + diagnosis otomatis
  (Sari 71% = 10/14 proposisi benar; Rudi 57% = 8/14), dan post-test.

## 5. Alur demo ke dosen (± 10 menit)

1. **Login peneliti** (alex) → buka _Static Analyzer_ → pilih assignment
   "Fotosintesis — Kelompok A (Segmen Paragraf)" → tunjukkan kanvas diagnosis
   (hijau = benar, kuning putus-putus = kurang, merah = keliru) + ringkasan skor.
2. Ganti ke "Kelompok B (Segmen Depth Topik)" → tunjukkan bahwa peta & siswa berbeda
   namun **goal map-nya sama**.
3. **Login siswa** (sari) → buka assignment → tunjukkan kit: konsep berwarna per segmen
   paragraf, dibangun satu segmen pada satu waktu.
4. Tutup dengan slide rumusan + variabel ukur (lihat §1).

## 6. Data teknis (untuk dikembangkan berikutnya)

- Seeder: `scripts/seed/photosynthesis.ts` — jalankan `pnpm run db:seed:fotosintesis`
  (idempoten, setelah `pnpm run db:seed`).
- Materi + goal map: `scripts/seed/data/material-fotosintesis.md`
  (frontmatter nodes/edges + teks 4 paragraf).
- Kit A & B dibuat dari goal map yang sama, hanya pewarnaan node berbeda;
  diagnosis memakai comparator yang sama dengan alur siswa asli.
- Langkah riset berikutnya (setelah arahan dosen): alur kit **per segmen berurutan**
  di editor siswa, randomisasi `studyGroup` otomatis saat masuk assignment, dan
  pencatatan waktu per segmen.
