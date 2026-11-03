import express from 'express';
import { prisma } from './lib/prisma';
import { Role, Lane, Currency } from './generated/prisma/enums';
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
app.get('/api/skins', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const heroId = (req.query.heroId as string) || '';
        const rarity = (req.query.rarity as string) || '';
 
        const skip = (page - 1) * limit;
        const whereCondition: any = {};
 
        if (heroId) {
            whereCondition.heroId = parseInt(heroId);
        }
        if (rarity) {
            whereCondition.rarity = rarity.toUpperCase();
        }
 
        const [skins, totalItems] = await Promise.all([
            prisma.skin.findMany({
                where: whereCondition,
                skip: skip,
                take: limit,
                include: {
                    hero: true,
                },
            }),
            prisma.skin.count({
                where: whereCondition,
            }),
        ]);
 
        if (skins.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Skin tidak ditemukan',
            });
        }
 
        const totalPages = Math.ceil(totalItems / limit);
        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil data skin',
            data: skins,
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
// --- 3b. Skin Detail ---
app.get('/api/skins/:skin_id', async (req, res) => {
    try {
        const id = parseInt(req.params.skin_id as string);
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID skin tidak valid',
            });
        }
 
        const skin = await prisma.skin.findUnique({
            where: { id: id },
            include: {
                hero: true,
            },
        });
 
        if (!skin) {
            return res.status(404).json({
                status: false,
                message: 'Skin tidak ditemukan',
            });
        }
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil detail skin',
            data: skin,
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
 
// --- 4. Player ---
app.post('/api/players', async (req, res) => {
    try {
        const { nickname } = req.body;
 
        if (!nickname || String(nickname).trim() === '') {
            return res.status(400).json({
                status: false,
                message: 'Field nickname wajib diisi',
            });
        }
 
        const existingPlayer = await prisma.player.findUnique({
            where: { nickname: nickname },
        });
 
        if (existingPlayer) {
            return res.status(409).json({
                status: false,
                message: 'Nickname sudah dipakai',
            });
        }
 
        const newPlayer = await prisma.player.create({
            data: {
                nickname: nickname,
            },
        });
 
        return res.status(201).json({
            status: true,
            message: 'Berhasil membuat player baru',
            data: newPlayer,
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
// --- 4b. Player Detail ---
app.get('/api/players/:player_id', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        const player = await prisma.player.findUnique({
            where: { id: id },
            include: {
                playerHeros: {
                    include: {
                        hero: true,
                    },
                },
            },
        });
 
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil detail player',
            data: player,
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
// --- 4c. Update Player (ganti nickname) ---
app.patch('/api/players/:player_id', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
        const { nickname } = req.body;
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        const player = await prisma.player.findUnique({
            where: { id: id },
        });
 
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        if (!nickname || String(nickname).trim() === '') {
            return res.status(400).json({
                status: false,
                message: 'Field nickname wajib diisi',
            });
        }
 
        const existingPlayer = await prisma.player.findUnique({
            where: { nickname: nickname },
        });
 
        if (existingPlayer && existingPlayer.id !== id) {
            return res.status(409).json({
                status: false,
                message: 'Nickname sudah dipakai player lain',
            });
        }
 
        const updatedPlayer = await prisma.player.update({
            where: { id: id },
            data: { nickname: nickname },
        });
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil memperbarui player',
            data: updatedPlayer,
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
// --- 4d. Delete Player ---
app.delete('/api/players/:player_id', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        const player = await prisma.player.findUnique({
            where: { id: id },
        });
 
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        await prisma.player.delete({
            where: { id: id },
        });
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil menghapus player',
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
 
// --- 5. Top Up & Match ---
app.post('/api/players/:player_id/topup', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
        const { amount } = req.body;
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({
                status: false,
                message: 'amount harus bilangan bulat lebih dari 0',
            });
        }
 
        const player = await prisma.player.findUnique({
            where: { id: id },
        });
 
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        const updatedPlayer = await prisma.player.update({
            where: { id: id },
            data: {
                diamond: { increment: amount },
            },
        });
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil top up diamond',
            data: {
                id: updatedPlayer.id,
                nickname: updatedPlayer.nickname,
                diamond: updatedPlayer.diamond,
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
app.post('/api/players/:player_id/matches', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
        const { result } = req.body;
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        const resultUpper = String(result || '').toUpperCase();
 
        if (resultUpper !== 'WIN' && resultUpper !== 'LOSE') {
            return res.status(400).json({
                status: false,
                message: 'result harus WIN atau LOSE',
            });
        }
 
        const player = await prisma.player.findUnique({
            where: { id: id },
        });
 
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        const bpEarned = resultUpper === 'WIN' ? 300 : 100;
 
        const updatedPlayer = await prisma.player.update({
            where: { id: id },
            data: {
                bp: { increment: bpEarned },
            },
        });
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil menyelesaikan match',
            data: {
                id: updatedPlayer.id,
                nickname: updatedPlayer.nickname,
                result: resultUpper,
                bpEarned: bpEarned,
                bp: updatedPlayer.bp,
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
 
// --- 6. Beli Hero ---
app.post('/api/players/:player_id/heroes', async (req, res) => {
    try {
        const id = parseInt(req.params.player_id as string);
        const { heroId, currency } = req.body;
 
        if (isNaN(id)) {
            return res.status(400).json({
                status: false,
                message: 'ID player tidak valid',
            });
        }
 
        const currencyUpper = String(currency || '').toUpperCase();
 
        if (
            heroId === undefined ||
            heroId === null ||
            heroId === '' ||
            (currencyUpper !== 'BP' && currencyUpper !== 'DIAMOND')
        ) {
            return res.status(400).json({
                status: false,
                message: 'heroId wajib diisi dan currency harus BP atau DIAMOND',
            });
        }
 
        const heroIdInt = parseInt(heroId);
 
        const player = await prisma.player.findUnique({
            where: { id: id },
        });
        if (!player) {
            return res.status(404).json({
                status: false,
                message: 'Player tidak ditemukan',
            });
        }
 
        const hero = await prisma.hero.findUnique({
            where: { id: heroIdInt },
        });
        if (!hero) {
            return res.status(404).json({
                status: false,
                message: 'Hero tidak ditemukan',
            });
        }
 
        const price = currencyUpper === 'BP' ? hero.priceBP : hero.priceDiamond;
        if (price === null || price === undefined) {
            return res.status(400).json({
                status: false,
                message: `Hero ini tidak bisa dibeli dengan ${currencyUpper}`,
            });
        }
 
        const owned = await prisma.playerHero.findUnique({
            where: {
                playerId_heroId: {
                    playerId: id,
                    heroId: heroIdInt,
                },
            },
        });
        if (owned) {
            return res.status(409).json({
                status: false,
                message: 'Player sudah memiliki hero ini',
            });
        }
 
        const balance = currencyUpper === 'BP' ? player.bp : player.diamond;
        if (balance < price) {
            return res.status(400).json({
                status: false,
                message: `Saldo ${currencyUpper} tidak cukup`,
            });
        }
 
        const [updatedPlayer, newPlayerHero] = await prisma.$transaction([
            prisma.player.update({
                where: { id: id },
                data:
                    currencyUpper === 'BP'
                        ? { bp: { decrement: price } }
                        : { diamond: { decrement: price } },
            }),
            prisma.playerHero.create({
                data: {
                    playerId: id,
                    heroId: heroIdInt,
                    currency: currencyUpper as Currency,
                    pricePaid: price,
                },
                include: {
                    hero: true,
                },
            }),
        ]);
 
        return res.status(201).json({
            status: true,
            message: 'Berhasil membeli hero',
            data: {
                hero: newPlayerHero.hero,
                currency: currencyUpper,
                pricePaid: price,
                bp: updatedPlayer.bp,
                diamond: updatedPlayer.diamond,
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
 
// --- 7. Statistik ---
app.get('/api/statistics', async (req, res) => {
    try {
        const [totalPlayers, totalHeroesOwned, diamondAgg, mostOwnedGroup, heroesPerRoleGroup] =
            await Promise.all([
                prisma.player.count(),
                prisma.playerHero.count(),
                prisma.player.aggregate({
                    _sum: { diamond: true },
                }),
                prisma.playerHero.groupBy({
                    by: ['heroId'],
                    _count: { heroId: true },
                    orderBy: {
                        _count: { heroId: 'desc' },
                    },
                    take: 1,
                }),
                prisma.hero.groupBy({
                    by: ['role'],
                    _count: { role: true },
                }),
            ]);
 
        let mostOwnedHero: any = null;
        if (mostOwnedGroup.length > 0) {
            const top = mostOwnedGroup[0];
            const hero = await prisma.hero.findUnique({
                where: { id: top.heroId },
            });
            mostOwnedHero = {
                heroId: top.heroId,
                name: hero ? hero.name : null,
                ownedBy: top._count.heroId,
            };
        }
 
        const heroesPerRole: Record<string, number> = {};
        for (const row of heroesPerRoleGroup) {
            heroesPerRole[row.role] = row._count.role;
        }
 
        return res.status(200).json({
            status: true,
            message: 'Berhasil mengambil statistik',
            data: {
                totalPlayers: totalPlayers,
                totalHeroesOwned: totalHeroesOwned,
                totalDiamond: diamondAgg._sum.diamond ?? 0,
                mostOwnedHero: mostOwnedHero,
                heroesPerRole: heroesPerRole,
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
 
export default app;