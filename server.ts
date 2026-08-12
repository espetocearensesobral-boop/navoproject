import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiApp from "./backend/index.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount API
  app.use(apiApp);

  // Catch-all para rotas de API inexistentes (evita retornar o HTML do Vite em endpoints errados)
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
