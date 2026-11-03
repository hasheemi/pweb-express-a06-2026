import express from 'express';
import { prisma } from './lib/prisma';
import { Role, Lane } from './generated/prisma/enums';
// import { Prisma } from "../src/generated/prisma/client";

const app = express();
app.use(express.json());

// --- Health ---
app.get('/health', (req, res) => {
    res.json('hello');
});

// --- DB check: Prisma + Neon ---
app.get('/db-check', async (req, res) => {
    try {
        const [ping] = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
        const [heroes, skins, players, playerHeroes] = await Promise.all([
            prisma.hero.count(),
            prisma.skin.count(),
            prisma.player.count(),
            prisma.playerHero.count(),
        ]);

        res.json({
            status: 'ok',
            database: 'neon-postgresql',
            serverTime: ping.now,
            counts: { heroes, skins, players, playerHeroes },
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'neon-postgresql',
            message: error instanceof Error ? error.message : String(error),
        });
    }
});

// --- 2. Hero ---
app.get('/api/heroes', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || '';
        const role = (req.query.role as string) || '';

        const skip = (page - 1) * limit;
        const whereCondition: any = {};

        if (search) {
            whereCondition.name = {
                contains: search,
                mode: 'insensitive',
            };
        }
        if (role) {
            whereCondition.role = role.toUpperCase();
        }

        const [heroes, totalItems] = await Promise.all([
            prisma.hero.findMany({
                where: whereCondition,
                skip: skip,
                take: limit,
            }),
            prisma.hero.count({
                where: whereCondition,
            }),
        ]);

        if (heroes.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Hero tidak ditemukan',
            });
        }

        const totalPages = Math.ceil(totalItems / limit);
        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil data hero',
            data: heroes,
            metadata: {
                currentPage: page,
                limit: limit,
                totalItems: totalItems,
                totalPages: totalPages,
            },
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message:
                e instanceof Error
                    ? `Terjadi kesalahan: ${e.message}`
                    : 'Terjadi kesalahan pada server',
        });
    }
});
// --- 2b. Hero Detail ---
app.get('/api/heroes/:hero_id', async (req, res) => {
    try {
        const id = parseInt(req.params.hero_id as string);

        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID hero tidak valid',
            });
        }

        const hero = await prisma.hero.findUnique({
            where: { id: id },
            include: {
                skins: true,
            },
        });

        if (!hero) {
            return res.status(404).json({
                status: false,
                message: 'Hero tidak ditemukan',
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil detail hero',
            data: hero,
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message:
                e instanceof Error
                    ? `Terjadi kesalahan: ${e.message}`
                    : 'Terjadi kesalahan pada server',
        });
    }
});
// --- 2c. Create Hero ---
app.post('/api/heroes', async (req, res) => {
    try {
        const { name, role, lane, releaseYear, priceBP, priceDiamond } = req.body;

        // validasi
        if (
            !name ||
            !role ||
            !lane ||
            releaseYear === undefined ||
            releaseYear === null ||
            releaseYear === ''
        ) {
            return res.status(400).json({
                status: false,
                message: 'Field name, role, lane, dan releaseYear wajib diisi',
            });
        }

        // cek eksisting
        const existingHero = await prisma.hero.findFirst({
            where: { name: name },
        });

        if (existingHero) {
            return res.status(409).json({
                status: false,
                message: 'Nama hero sudah ada',
            });
        }

        const newHero = await prisma.hero.create({
            data: {
                name,
                role: String(role).toUpperCase() as Role,
                lane: String(lane).toUpperCase() as Lane,
                releaseYear: parseInt(releaseYear),
                priceBP:
                    priceBP !== undefined && priceBP !== null && priceBP !== ''
                        ? parseInt(priceBP)
                        : 0,
                priceDiamond:
                    priceDiamond !== undefined && priceDiamond !== null && priceDiamond !== ''
                        ? parseInt(priceDiamond)
                        : 0,
            },
        });

        return res.status(201).json({
            status: true,
            message: 'Berhasil membuat hero baru',
            data: newHero,
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            message:
                error instanceof Error
                    ? `Terjadi kesalahan: ${error.message}`
                    : 'Terjadi kesalahan pada server',
        });
    }
});

// --- 3. Skin ---
app.get('/api/skins', (req, res) => {
    res.json('hello');
});
app.get('/api/skins/:skin_id', (req, res) => {
    res.json('hello');
});

// --- 4. Player ---
app.post('/api/players', (req, res) => {
    res.json('hello');
});
app.get('/api/players/:player_id', (req, res) => {
    res.json('hello');
});
app.patch('/api/players/:player_id', (req, res) => {
    res.json('hello');
});
app.delete('/api/players/:player_id', (req, res) => {
    res.json('hello');
});

// --- 5. Top Up & Match ---
app.post('/api/players/:player_id/topup', (req, res) => {
    res.json('hello');
});
app.post('/api/players/:player_id/matches', (req, res) => {
    res.json('hello');
});

// --- 6. Beli Hero ---
app.post('/api/players/:player_id/heroes', (req, res) => {
    res.json('hello');
});

// --- 7. Statistik ---
app.get('/api/statistics', (req, res) => {
    res.json('hello');
});

export default app;
