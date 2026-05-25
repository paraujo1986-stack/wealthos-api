import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticação JWT (PIN-based).
 * Injeta req.user = { id, householdId }
 */
export function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error:   'TOKEN_MISSING',
      message: 'Autenticação necessária.',
    });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:          payload.householdId, // fallback para campo createdBy nos snapshots
      householdId: payload.householdId,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error:   'TOKEN_EXPIRED',
        message: 'Sessão expirada — reintroduz o PIN.',
      });
    }
    return res.status(401).json({
      error:   'TOKEN_INVALID',
      message: 'Token inválido.',
    });
  }
}
