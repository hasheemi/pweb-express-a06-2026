import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/prisma";
import { Currency, Rarity, Role, Lane } from "../src/generated/prisma/enums";

// ---------------------------------------------------------------- helpers

type HeroRow = {
  id: number;
  name: string;
  primaryRole: string;
  primaryLane: string;
  releaseYear: string;
  priceBP: string;
  priceDiamond: string;
};

type SkinRow = {
  id: number;
  name: string;
  heroId: number;
  rarity: string;
  priceDiamond: string;
};

function readCsv<T>(file: string): T[] {
  const raw = fs.readFileSync(path.join(__dirname, "..", "data", file), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

// ---------------------------------------------------------------- seed

async function main() {
  // 1. Kosongkan semua tabel — id kembali ke 1
  await prisma.$executeRawUnsafe(
    `TRUNCATE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE;`
  );
  console.log("✓ tables truncated, identity reset");

  // 2. Semua hero (id otomatis: Miya = 1, Hirara = 133)
  const heroRows = readCsv<HeroRow>("heroes.csv");
  await prisma.hero.createMany({
    data: heroRows.map((h) => ({
      name: h.name,
      role: h.primaryRole as Role,
      lane: h.primaryLane as Lane,
      releaseYear: Number(h.releaseYear),
      priceBP: Number(h.priceBP),
      priceDiamond: Number(h.priceDiamond),
    })),
  });
  console.log(`✓ ${heroRows.length} heroes inserted`);

  // 3. Semua skin (priceDiamond kosong → 0)
  const skinRows = readCsv<SkinRow>("skins.csv");
  await prisma.skin.createMany({
    data: skinRows.map((s) => ({
      name: s.name,
      heroId: Number(s.heroId),
      rarity: s.rarity as Rarity,
      priceDiamond: s.priceDiamond === "" ? 0 : Number(s.priceDiamond),
    })),
  });
  console.log(`✓ ${skinRows.length} skins inserted`);

  // 4. Player
  await prisma.player.createMany({
    data: [
      { id: 1, nickname: "ArekITS", bp: 1500, diamond: 75 },
      { id: 2, nickname: "SangPushRank", bp: 13000, diamond: 2892 },
      { id: 3, nickname: "MageSurabaya", bp: 10000, diamond: 0 },
    ],
  });
  console.log("✓ 3 players inserted");

  // 5. PlayerHero
  await prisma.playerHero.createMany({
    data: [
      { playerId: 1, heroId: 18, currency: Currency.BP, pricePaid: 2000 }, // Layla
      { playerId: 1, heroId: 1, currency: Currency.BP, pricePaid: 10800 }, // Miya
      { playerId: 2, heroId: 84, currency: Currency.DIAMOND, pricePaid: 599 }, // Ling
      { playerId: 2, heroId: 56, currency: Currency.BP, pricePaid: 32000 }, // Gusion
    ],
  });
  console.log("✓ 4 playerheroes inserted");

  const [heroes, skins, players, playerHeroes] = await Promise.all([
    prisma.hero.count(),
    prisma.skin.count(),
    prisma.player.count(),
    prisma.playerHero.count(),
  ]);
  console.log(`\nSummary: heroes=${heroes} skins=${skins} players=${players} playerHeroes=${playerHeroes}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
