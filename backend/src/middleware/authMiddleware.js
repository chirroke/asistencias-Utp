const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { JWT_SECRET } = require('../config/secrets');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(verified.id);
    if (!user) {
      return res.status(401).json({ error: 'Tu cuenta está inactiva o ya no existe. Contacta al administrador.' });
    }
    req.user = { ...verified, id: user.id, rol: user.rol, correo: user.correo };
    next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('No se pudo validar el estado de la cuenta:', error.message);
      return res.status(503).json({ error: 'No se pudo validar tu cuenta. Intenta nuevamente.' });
    }
    res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

const verificarRol = (rolesPermitidos = []) => {
  return (req, res, next) => {
    const rolUsuario = req.user?.rol;

    if (!rolUsuario || !rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        error: 'Acceso Denegado: No tienes permisos para este recurso'
      });
    }
    next();
  };
};

// Se exportan AMBOS middlewares juntos en un solo objeto
module.exports = { verifyToken, verificarRol };
