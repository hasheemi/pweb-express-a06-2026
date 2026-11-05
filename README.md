# Praktikum Pemrograman Web

**Departemen Teknologi Informasi - 2025**

## Anggota Kelompok A06

| Nama                     | NRP        |
| ------------------------ | ---------- |
| Muhammad Hugo Rayandra E | 5027251076 |
| Hasheemi Rafsanjani      | 5027251015 |
| Syarifah Nailatur Rohma  | 5027251109 |

## Deskripsi Singkat

MLBB Shop API adalah backend e-commerce sederhana yang menyediakan katalog **hero** dan **skin**
Mobile Legends, pengelolaan **player**, top up diamond, hadiah match, pembelian hero memakai BP atau
Diamond, serta endpoint **statistik** toko. Data hero (133) dan skin (892) di-seed dari file CSV,
lalu dihubungkan ke database PostgreSQL di Neon menggunakan Prisma 7 dengan driver adapter
`@prisma/adapter-neon`. Setiap request dicatat oleh middleware logger, error dibalas dengan format
konsisten lewat `HttpError` + `errorHandler`, dan URL yang tidak terdaftar dijawab 404 oleh
middleware `notFound`.

## Struktur Folder

```
root/
│
├── src/
│   ├── app.ts                  # definisi semua route + pemasangan middleware
│   ├── main.ts                 # bootstrap server (retry koneksi lalu listen)
│   ├── lib/
│   │   └── prisma.ts           # singleton PrismaClient + Neon adapter
│   ├── middleware/
│   │   ├── logger.ts           # log setiap request ke terminal
│   │   └── error.ts            # HttpError, notFound, errorHandler
│   └── generated/prisma/       # hasil `prisma generate` (tidak di-commit)
│
├── prisma/
│   ├── schema.prisma           # model + enum
│   └── seed.ts                 # TRUNCATE + seed hero, skin, player, playerHero
│
├── data/
│   ├── heroes.csv              # 133 hero
│   └── skins.csv               # 892 skin
│
├── scripts/
│   └── run-tests.mjs           # otomasi 28 testcase dari test.json
│
├── test.json                   # koleksi testcase
├── prisma.config.ts            # config Prisma 7 (schema, seed, datasource)
├── .env.example
├── package.json
└── tsconfig.json
```

## Endpoint

| Fitur                | Metode | Endpoint                          |
| -------------------- | ------ | --------------------------------- |
| Health               | GET    | `/health`                         |
| Cek koneksi database | GET    | `/db-check`                       |
| Hero                 | GET    | `/api/heroes`                     |
| Hero                 | GET    | `/api/heroes/:hero_id`            |
| Hero                 | POST   | `/api/heroes`                     |
| Skin                 | GET    | `/api/skins`                      |
| Skin                 | GET    | `/api/skins/:skin_id`             |
| Player               | POST   | `/api/players`                    |
| Player               | GET    | `/api/players/:player_id`         |
| Player               | PATCH  | `/api/players/:player_id`         |
| Player               | DELETE | `/api/players/:player_id`         |
| Top Up               | POST   | `/api/players/:player_id/topup`   |
| Match                | POST   | `/api/players/:player_id/matches` |
| Beli Hero            | POST   | `/api/players/:player_id/heroes`  |
| Statistik            | GET    | `/api/statistics`                 |

### Aturan Diamond & BP

| Aturan                 | Nilai                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Saldo awal player baru | 10.000 BP dan 0 Diamond                                                              |
| Top up Diamond         | Diamond bertambah sebesar `amount` (integer > 0)                                     |
| Hadiah match           | WIN +300 BP, LOSE +100 BP                                                            |
| Beli hero              | Pakai BP (`priceBP`) atau Diamond (`priceDiamond`); harga kosong = tidak bisa dibeli |
| Satu hero satu kali    | Player tidak boleh membeli hero yang sudah dimiliki                                  |

### Format Response

```json
// sukses
{ "status": true, "message": "...", "data": {}, "metadata": {} }

// gagal
{ "status": false, "message": "..." }
```

## Menjalankan

```bash
npm install
cp .env.example .env        # isi DATABASE_URL & DATABASE_URL_POOLED dari Neon
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev                 # http://localhost:3002
```

## Teknologi

- Node.js + TypeScript
- Express 5
- Prisma ORM 7 + `@prisma/adapter-neon`
- PostgreSQL (Neon)
- `ws` + `@neondatabase/serverless`
- `csv-parse`, `dotenv`, `tsx`
