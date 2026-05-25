import { Router } from 'express';
import jwt         from 'jsonwebtoken';
import crypto      from 'crypto';
import { prisma }  from '../lib/prisma.js';

const router = Router();

// ── POST /auth/pin ────────────────────────────────────────────────
// Entrar com PIN. Cria household se não existir.
// PIN hash SHA-256 guardado em inviteCode (único e determinístico).
// Token válido 30 dias — sem refresh necessário.

router.post('/pin', async (req, res, next) => {
  try {
    const pin = String(req.body?.pin || '').trim();
    if (pin.length < 4) {
      return res.status(400).json({ message: 'PIN inválido (mínimo 4 dígitos).' });
    }

    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');

    let household = await prisma.household.findUnique({ where: { inviteCode: pinHash } });
    if (!household) {
      household = await prisma.household.create({
        data: { name: 'Household', inviteCode: pinHash },
      });
    }

    const token = jwt.sign(
      { householdId: household.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, householdId: household.id });
  } catch (err) {
    next(err);
  }
});

export default router;
