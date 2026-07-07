import 'dotenv/config';
import express from 'express';
import todoRoutes from './routes/todo.js';
import cors from 'cors';


const app = express();
const PORT = process.env.PORT ?? 3000;

// ── 中间件 ──
app.use(express.json());

// ── 路由 ──
app.use('/api/todos', todoRoutes);

// ── 健康检查 ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── 全局错误处理 ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

app.use(cors({
  origin: 'https://my-ai-app-khaki.vercel.app'
}));

export default app;
