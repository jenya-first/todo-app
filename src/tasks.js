import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { query } from './db.js';
import { config } from './config.js';
import * as v from './validate.js';

const COLUMNS = 'id, owner_login, title, done, run_id, created_at';

function toApi(row) {
  return {
    id: row.id,
    ownerLogin: row.owner_login,
    title: row.title,
    done: row.done,
    runId: row.run_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function notFound(res) {
  res.status(404).json({ error: 'Task not found' });
}

export const tasksRouter = Router();
const owner = config.authorLogin;

tasksRouter.post('/', async (req, res) => {
  const { title, runId } = v.createBody(req.body);
  const { rows } = await query(
    `INSERT INTO tasks (id, owner_login, title, done, run_id, created_at)
     VALUES ($1, $2, $3, false, $4, now()) RETURNING ${COLUMNS}`,
    [randomUUID(), owner, title, runId],
  );
  res.status(201).json(toApi(rows[0]));
});

tasksRouter.get('/', async (req, res) => {
  const raw = req.query.runId;
  if (raw === undefined) throw new v.ValidationError('runId query parameter is required');
  const runId = v.runId(raw);
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM tasks WHERE owner_login = $1 AND run_id = $2 ORDER BY created_at, id`,
    [owner, runId],
  );
  res.json(rows.map(toApi));
});

tasksRouter.get('/:id/', async (req, res) => {
  const id = v.uuid(req.params.id);
  const { rows } = await query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND owner_login = $2`, [
    id,
    owner,
  ]);
  if (!rows.length) return notFound(res);
  res.json(toApi(rows[0]));
});

tasksRouter.patch('/:id/', async (req, res) => {
  const id = v.uuid(req.params.id);
  const patch = v.patchBody(req.body);
  const sets = [];
  const params = [id, owner];
  if ('title' in patch) {
    params.push(patch.title);
    sets.push(`title = $${params.length}`);
  }
  if ('done' in patch) {
    params.push(patch.done);
    sets.push(`done = $${params.length}`);
  }
  const { rows } = await query(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = $1 AND owner_login = $2 RETURNING ${COLUMNS}`,
    params,
  );
  if (!rows.length) return notFound(res);
  res.json(toApi(rows[0]));
});

tasksRouter.delete('/:id/', async (req, res) => {
  const id = v.uuid(req.params.id);
  const { rowCount } = await query('DELETE FROM tasks WHERE id = $1 AND owner_login = $2', [id, owner]);
  if (!rowCount) return notFound(res);
  res.status(204).end();
});
