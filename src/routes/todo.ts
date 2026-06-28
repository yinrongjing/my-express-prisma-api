import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';

const router = Router();

// ── Zod 4 Schema 定义（字段对齐 prisma/schema.prisma 的 Todo 模型）──

const createTodoSchema = z.object({
  taskName: z.string().min(1, '任务名称不能为空').max(200),
  desp: z.string().max(500).optional()
});

const updateTodoSchema = z.object({
  taskName: z.string().min(1).max(200).optional(),
  desp: z.string().max(500).optional(),
  completed: z.string().optional(),
});

// ── 工具函数 ──

/**
 * 从 Zod 4 的 safeParse 结果中安全提取第一条错误消息
 * Zod 4: safeParse 返回 { success: boolean; data?: T; error?: ZodError }
 * ZodError 使用 .issues 数组（不是 v3 的 .errors），每个 issue 有 .message
 * 全程不用 ! 非空断言，靠可选链 ?. 兜底
 */
function firstZodMessage(parsed: { success: boolean; error?: { issues?: readonly { message: string }[] } }): string {
  if (parsed.success) return '未知校验错误';
  return parsed.error?.issues?.[0]?.message ?? '请求参数不合法';
}

/**
 * 安全地从 Express 请求参数中提取数字 ID
 * Express 5 的 req.params 值可能是 string | string[]，用 String() 归一化
 */
function parseId(req: Request): number | null {
  const raw = req.params.id;
  if (!raw) return null;
  const id = parseInt(String(raw), 10);
  return isNaN(id) ? null : id;
}

// ── GET /api/todos ── 获取所有 Todo

router.get('/', async (_req: Request, res: Response) => {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(todos);
  } catch (err) {
    console.error('GET /todos error:', err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});
// ── GET /api/todos/:id ── 获取单个 Todo

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req);
    if (id === null) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }
    const todo = await prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }
    res.json(todo);
  } catch {
    res.status(500).json({ error: '获取任务失败' });
  }
});

// ── POST /api/todos ── 创建 Todo

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodMessage(parsed) });
      return;
    }
    const todo = await prisma.todo.create({
      data: {
        taskName: parsed.data.taskName,
        desp: parsed.data.desp,
      },
    });
    res.status(201).json(todo);
  } catch {
    res.status(500).json({ error: '创建任务失败' });
  }
});

// ── PUT /api/todos/:id ── 更新 Todo

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req);
    if (id === null) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    const parsed = updateTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodMessage(parsed) });
      return;
    }

    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: parsed.data,
    });
    res.json(todo);
  } catch {
    res.status(500).json({ error: '更新任务失败' });
  }
});

// ── DELETE /api/todos/:id ── 删除 Todo

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req);
    if (id === null) {
      res.status(400).json({ error: '无效的 ID' });
      return;
    }

    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }

    await prisma.todo.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: '删除任务失败' });
  }
});

export default router;
