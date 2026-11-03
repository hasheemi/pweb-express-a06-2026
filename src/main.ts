import app from './app';
import { prisma } from './lib/prisma';

const PORT = Number(process.env.PORT ?? 3002);

async function main() {
    // Prove the Neon connection works before accepting traffic.
    await prisma.$queryRaw`SELECT 1`;

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

main().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
