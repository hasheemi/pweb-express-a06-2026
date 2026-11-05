import app from './app';
import { connectWithRetry } from './lib/prisma';

const PORT = Number(process.env.PORT ?? 3002);

async function main() {
    // Prove the Neon connection works before accepting traffic.
    // Retries cover Neon cold starts after an idle suspend.
    await connectWithRetry();

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

main().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
