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

// ── GET /api/todos ── 分页获取 Todo（?page=1&pageSize=10）

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize)) || 10));
    const skip = (page - 1) * pageSize;
    const keyword = String(req.query.keyword ?? '');
    const status = String(req.query.status ?? '');

    // 构建搜索条件
    const where: Record<string, unknown> = {};
    if (keyword) where.taskName = { contains: keyword };
    if (status) where.completed = status;

    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { id: 'asc' },
      }),
      prisma.todo.count({ where }),
    ]);

    res.json({
      list: todos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('GET /todos error:', err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

// ── POST /api/todos/seed ── 写入 50 条测试数据
// 注意：这个路由必须在 /:id 前面，否则 /seed 会被 :id 匹配

router.post('/seed', async (_req: Request, res: Response) => {
  try {
    const tasks: { taskName: string; desp: string; completed: string }[] = [];
    const statuses = ['pending', 'running', 'done'];
    const prefixes = [
      '前端页面优化', '后端接口开发', '数据库设计', '用户反馈处理',
      '性能监控', '安全审计', '文档编写', '单元测试', '集成测试',
      '部署上线',
    ];
    const suffixes = ['第一期', '第二期', '优化版', '紧急修复', '日常维护'];

    for (let i = 0; i < 50; i++) {
      const prefix = prefixes[i % prefixes.length]!;
      const suffix = suffixes[Math.floor(i / prefixes.length) % suffixes.length]!;
      tasks.push({
        taskName: `${prefix}-${suffix}-${i + 1}`,
        desp: `这是第 ${i + 1} 条测试任务的描述，随机状态：${statuses[i % 3]}`,
        completed: statuses[i % 3]!,
      });
    }

    await prisma.todo.createMany({ data: tasks });
    res.status(201).json({ message: `成功写入 ${tasks.length} 条数据`, count: tasks.length });
  } catch (err) {
    console.error('POST /todos/seed error:', err);
    res.status(500).json({ error: '写入测试数据失败' });
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
