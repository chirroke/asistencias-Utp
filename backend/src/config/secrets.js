// Secreto de firma de los JWT, tickets WebSocket y tokens QR.
// En producción es obligatorio definir JWT_SECRET: sin él, cualquiera podría falsificar sesiones
// usando el valor de desarrollo que está en el código.
require('dotenv').config(); // cargar .env antes de leer JWT_SECRET, sin importar quién importe primero
const VALOR_DESARROLLO = 'secreto_desarrollo';
const enProduccion = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

const obtenerJwtSecret = () => {
  const definido = process.env.JWT_SECRET;
  if (enProduccion) {
    if (!definido || definido === VALOR_DESARROLLO) {
      throw new Error('JWT_SECRET no está configurado (o usa el valor de desarrollo). Defínelo en las variables de entorno antes de iniciar en producción.');
    }
    return definido;
  }
  if (!definido) console.warn('[seguridad] JWT_SECRET no definido: usando valor de desarrollo. No uses esto en producción.');
  return definido || VALOR_DESARROLLO;
};

module.exports = { JWT_SECRET: obtenerJwtSecret(), enProduccion };
