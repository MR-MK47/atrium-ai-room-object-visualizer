import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.ts';

const PORT = Number(process.env.PORT) || 3000;

export async function startServer(): Promise<void> {
  const app = createApiApp();

  // Mount Vite dev server in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Atrium] Server listening on http://localhost:${PORT}`);
  });
}

// Only start standalone server when running directly, not in serverless environments
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[Atrium] Failed to start server:', err);
    process.exit(1);
  });
}
