#!/usr/bin/env node
/**
 * Menjalankan seluruh testcase di test.json memakai curl, berurutan 01 → 28.
 *
 * Pemakaian:
 *   node scripts/run-tests.mjs                      # server harus sudah jalan di :3002
 *   node scripts/run-tests.mjs --port 3002 --seed   # seed dulu, lalu tes
 *   node scripts/run-tests.mjs --seed --start       # seed + start server sendiri (dist/)
 *   node scripts/run-tests.mjs --only 14            # hanya testcase ke-14
 *
 * Catatan: testcase bersifat stateful. Selalu jalankan dengan --seed agar
 * id & saldo kembali ke kondisi awal.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync, spawn } from 'node:child_process';

// ------------------------------------------------------------------ args

const argv = process.argv.slice(2);
const flag = (name, fallback = false) => {
    const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return fallback;
    const hit = argv[i];
    if (hit.includes('=')) return hit.slice(hit.indexOf('=') + 1);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) return next;
    return true;
};

const PORT = String(flag('port', process.env.PORT || '3002'));
const BASE = `http://127.0.0.1:${PORT}`;
const SEED = Boolean(flag('seed', false));
const START = Boolean(flag('start', false));
const ONLY = flag('only', null);
const ROOT = process.cwd();

// ------------------------------------------------------------------ helpers

function curl(method, url, body) {
    const out = path.join(
        os.tmpdir(),
        `api-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );
    const args = ['-sS', '-m', '20', '-o', out, '-w', '%{http_code}', '-X', method];
    if (body) args.push('-H', 'Content-Type: application/json', '--data-raw', body);
    args.push(url);

    let code = '000';
    try {
        code = execFileSync('curl', args, { encoding: 'utf8' }).trim();
    } catch {
        code = '000';
    }

    let text = '';
    try {
        text = fs.readFileSync(out, 'utf8');
    } catch {
        /* body kosong */
    }
    try {
        fs.unlinkSync(out);
    } catch {
        /* ignore */
    }

    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        /* bukan JSON */
    }
    return { code, text, json };
}

function health() {
    try {
        return execFileSync(
            'curl',
            ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '3', `${BASE}/health`],
            { encoding: 'utf8' }
        ).trim();
    } catch {
        return '000';
    }
}

async function waitHealth(timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (health() === '200') return true;
        await new Promise((r) => setTimeout(r, 400));
    }
    return false;
}

function expectedStatus(description) {
    const m = /Hasil yang benar:\s*(\d{3})/.exec(description || '');
    return m ? m[1] : null;
}

/**
 * Assertion tambahan di luar status code.
 * Mengembalikan null kalau lolos, atau string alasan gagal.
 */
function extraCheck(n, res) {
    const j = res.json;

    switch (n) {
        case 2:
            return j?.metadata?.totalItems === 20
                ? null
                : `totalItems=${j?.metadata?.totalItems}, harusnya 20`;
        case 3:
            return j?.metadata?.totalItems === 10
                ? null
                : `totalItems=${j?.metadata?.totalItems}, harusnya 10`;
        case 4: {
            const skins = j?.data?.skins?.length;
            if (j?.data?.name !== 'Layla') return `data.name=${j?.data?.name}, harusnya Layla`;
            if (skins !== 11) return `jumlah skin=${skins}, harusnya 11`;
            return null;
        }
        case 6:
            if (j?.data?.id !== 134) return `id=${j?.data?.id}, harusnya 134`;
            if (j?.data?.name !== 'Collie') return `name=${j?.data?.name}, harusnya Collie`;
            return null;
        case 9:
            return j?.metadata?.totalItems === 11
                ? null
                : `totalItems=${j?.metadata?.totalItems}, harusnya 11`;
        case 10:
            return j?.metadata?.totalItems === 98
                ? null
                : `totalItems=${j?.metadata?.totalItems}, harusnya 98`;
        case 11:
            if (j?.data?.name !== 'Silverbolt Raiko')
                return `name=${j?.data?.name}, harusnya Silverbolt Raiko`;
            if (j?.data?.hero?.name !== 'Selena')
                return `hero=${j?.data?.hero?.name}, harusnya Selena`;
            return null;
        case 12:
            if (j?.data?.id !== 4) return `id=${j?.data?.id}, harusnya 4`;
            if (j?.data?.nickname !== 'JunglerMalam')
                return `nickname=${j?.data?.nickname}, harusnya JunglerMalam`;
            return null;
        case 14:
            return j?.data?.diamond === 706
                ? null
                : `diamond=${j?.data?.diamond}, harusnya 706`;
        case 16:
            return j?.data?.bp === 10300 ? null : `bp=${j?.data?.bp}, harusnya 10300`;
        case 18:
            return j?.data?.diamond === 107
                ? null
                : `diamond=${j?.data?.diamond}, harusnya 107`;
        case 19:
            return j?.data?.bp === 8300 ? null : `bp=${j?.data?.bp}, harusnya 8300`;
        case 22: {
            const names = (j?.data?.playerHeros ?? []).map((ph) => ph?.hero?.name);
            if (!names.includes('Freya') || !names.includes('Layla'))
                return `hero dimiliki=[${names.join(', ')}], harusnya termasuk Freya & Layla`;
            return null;
        }
        case 23:
            return j?.data?.nickname === 'MageITS'
                ? null
                : `nickname=${j?.data?.nickname}, harusnya MageITS`;
        case 25:
            if (j?.status !== true) return `status=${j?.status}, harusnya true`;
            if (typeof j?.data !== 'object' || j.data === null)
                return 'data statistik tidak ada';
            return null;
        default:
            return null;
    }
}

function short(text, max = 220) {
    const one = String(text ?? '').replace(/\s+/g, ' ').trim();
    return one.length > max ? `${one.slice(0, max)}…` : one;
}

// ------------------------------------------------------------------ main

async function main() {
    const collection = JSON.parse(fs.readFileSync(path.join(ROOT, 'test.json'), 'utf8'));
    let items = collection.item;

    if (ONLY) {
        const n = parseInt(ONLY, 10);
        items = items.filter((_, i) => i + 1 === n);
    }

    if (SEED) {
        console.log('▶ Menjalankan seed (TRUNCATE + data awal)…\n');
        execSync('./node_modules/.bin/tsx prisma/seed.ts', { cwd: ROOT, stdio: 'inherit' });
        console.log('');
    }

    let child = null;
    if (health() !== '200') {
        if (!START) {
            console.error(
                `✖ Server tidak merespons di ${BASE}.\n` +
                    `  Jalankan server dulu (npm run dev) atau pakai --start.`
            );
            process.exit(2);
        }
        console.log(`▶ Menjalankan server di port ${PORT}…`);
        child = spawn(process.execPath, ['dist/src/main.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT },
            stdio: 'ignore',
        });
    } else {
        console.log(`▶ Memakai server yang sudah berjalan di ${BASE}`);
    }

    const ready = await waitHealth(30000);
    if (!ready) {
        console.error(`✖ Server tidak siap di ${BASE} setelah 30 detik.`);
        if (child) child.kill('SIGTERM');
        process.exit(2);
    }
    console.log('');

    const results = [];

    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const n = ONLY ? parseInt(ONLY, 10) : i + 1;
        const req = item.request;
        const method = req.method;
        const url = req.url.raw.replace(/^https?:\/\/localhost:\d+/, BASE);
        const body = req.body?.raw ?? null;
        const expected = expectedStatus(req.description);

        const res = curl(method, url, body);

        const problems = [];
        if (expected && res.code !== expected) {
            problems.push(`status ${res.code}, harusnya ${expected}`);
        }
        const extra = extraCheck(n, res);
        if (extra) problems.push(extra);

        const passed = problems.length === 0;
        results.push({ n, name: item.name, passed });

        const label = String(n).padStart(2, '0');
        if (passed) {
            console.log(`✔ ${label} PASS  ${res.code}  ${item.name}`);
        } else {
            console.log(`✘ ${label} FAIL  ${res.code}  ${item.name}`);
            for (const p of problems) console.log(`        → ${p}`);
            console.log(`        body: ${short(res.text)}`);
        }
    }

    if (child) {
        child.kill('SIGTERM');
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    console.log('\n──────────────────────────────────────────────');
    console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
    if (failed > 0) {
        console.log('Gagal:');
        for (const r of results.filter((x) => !x.passed)) {
            console.log(`  - ${String(r.n).padStart(2, '0')} ${r.name}`);
        }
    }
    console.log('──────────────────────────────────────────────');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(2);
});
