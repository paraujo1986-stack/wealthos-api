import { Router } from 'express';
import crypto      from 'crypto';
import { z }       from 'zod';
import { prisma }  from '../lib/prisma.js';
import { auth }    from '../middleware/auth.js';

const router = Router();

const SNAPSHOT_RETENTION = 50;      // snapshots a manter por household
const MAX_SNAPSHOT_BYTES  = 5_000_000; // 5MB — protecção contra abuso

function makeChecksum(data) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

// ── GET /api/data ─────────────────────────────────────────────────
// Retorna o snapshot mais recente do household

router.get('/', auth, async (req, res, next) => {
  try {
    const snapshot = await prisma.snapshot.findFirst({
      where:   { householdId: req.user.householdId },
      orderBy: { createdAt: 'desc' },
      select:  {
        id:        true,
        data:      true,
        version:   true,
        checksum:  true,
        size:      true,
        createdAt: true,
        createdBy: true,
      },
    });

    if (!snapshot) {
      return res.json({ data: null, checksum: null, savedAt: null });
    }

    // ETag + conditional GET (If-None-Match) — evita re-download quando dados não mudaram
    const etag = `"${snapshot.checksum}"`;
    res.set('ETag',          etag);
    res.set('Cache-Control', 'no-cache');

    // 304 Not Modified: cliente já tem a versão mais recente
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.json({
      data:      snapshot.data,
      version:   snapshot.version,
      checksum:  snapshot.checksum,
      savedAt:   snapshot.createdAt,
      savedBy:   snapshot.createdBy,
      size:      snapshot.size,
    });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/data ─────────────────────────────────────────────────
// Guarda novo snapshot com optimistic locking via checksum

const SaveSchema = z.object({
  data:         z.record(z.unknown()),
  version:      z.string().default('3.0'),
  lastChecksum: z.string().nullable().optional(),
});

router.put('/', auth, async (req, res, next) => {
  try {
    const parsed = SaveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error:   'VALIDATION',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { data, version, lastChecksum } = parsed.data;

    // Verificar tamanho
    const size = Buffer.byteLength(JSON.stringify(data));
    if (size > MAX_SNAPSHOT_BYTES) {
      return res.status(413).json({
        error:   'TOO_LARGE',
        message: `Snapshot excede ${MAX_SNAPSHOT_BYTES / 1_000_000}MB.`,
        size,
      });
    }

    // Buscar snapshot mais recente para conflict detection
    const latest = await prisma.snapshot.findFirst({
      where:   { householdId: req.user.householdId },
      orderBy: { createdAt: 'desc' },
      select:  { checksum: true, createdAt: true },
    });

    // Conflito: o cliente tem um checksum diferente do servidor
    // lastChecksum === null significa "sei que pode haver conflito, forçar upload"
    if (latest && lastChecksum !== null && lastChecksum !== undefined) {
      if (latest.checksum !== lastChecksum) {
        return res.status(409).json({
          error:          'CONFLICT',
          message:        'Os dados foram alterados noutro dispositivo.',
          serverChecksum: latest.checksum,
          serverSavedAt:  latest.createdAt,
        });
      }
    }

    const newChecksum = makeChecksum(data);

    // Idempotência: se o conteúdo é igual, não criar snapshot duplicado
    if (latest?.checksum === newChecksum) {
      return res.json({
        checksum: newChecksum,
        savedAt:  latest.createdAt,
        skipped:  true,
      });
    }

    // Criar snapshot
    const snapshot = await prisma.snapshot.create({
      data: {
        householdId: req.user.householdId,
        version,
        data,
        checksum: newChecksum,
        size,
        createdBy: req.user.id,
      },
    });

    // Limpeza assíncrona dos snapshots antigos (não bloqueia a resposta)
    prisma.snapshot
      .findMany({
        where:   { householdId: req.user.householdId },
        orderBy: { createdAt: 'desc' },
        skip:    SNAPSHOT_RETENTION,
        select:  { id: true },
      })
      .then((old) => {
        if (old.length > 0) {
          return prisma.snapshot.deleteMany({
            where: { id: { in: old.map((s) => s.id) } },
          });
        }
      })
      .catch(() => {});

    res.json({
      checksum: newChecksum,
      savedAt:  snapshot.createdAt,
      size,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/data/history ─────────────────────────────────────────
// Lista os últimos N snapshots (sem o campo data para não pesar)

router.get('/history', auth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const snapshots = await prisma.snapshot.findMany({
      where:   { householdId: req.user.householdId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  {
        id:        true,
        version:   true,
        checksum:  true,
        size:      true,
        createdAt: true,
        createdBy: true,
      },
    });

    res.json({ snapshots, total: snapshots.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/data/history/:id ─────────────────────────────────────
// Restaura snapshot específico (inclui os dados completos)

router.get('/history/:id', auth, async (req, res, next) => {
  try {
    const snapshot = await prisma.snapshot.findFirst({
      where: {
        id:          req.params.id,
        householdId: req.user.householdId, // garante que só vês os teus
      },
    });

    if (!snapshot) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    res.json({
      data:     snapshot.data,
      version:  snapshot.version,
      checksum: snapshot.checksum,
      savedAt:  snapshot.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
