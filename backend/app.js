const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();

const { iniciarJobCierreAutomatico } = require('./src/controllers/sesionController');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const { JWT_SECRET } = require('./src/config/secrets');

// Los clientes se autentican primero con un ticket corto emitido por la API.
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws/asistencia') return socket.destroy();
    const claims = jwt.verify(url.searchParams.get('ticket') || '', JWT_SECRET);
    if (claims.scope !== 'asistencia:live' || !claims.sesionId) return socket.destroy();
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.sesionId = claims.sesionId;
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.destroy();
  }
});

app.set('wss', wss);

// Middleware de CORS antes de las rutas
const allowedFrontendOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Peticiones sin Origin (curl/servicios locales) y la lista configurada.
    if (!origin || allowedFrontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado por CORS. Añádelo a FRONTEND_ORIGINS.'));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'], // el frontend lee el nombre del archivo de los reportes
}));

app.use(express.json());
app.get('/api/health', async (_req, res) => {
  try {
    await require('./src/config/db').query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

// Importar rutas
try {
  const authRoutes = require('./src/routes/authRoutes');
  app.use('/api/auth', authRoutes);
} catch (error) {
  console.error('Error al cargar las rutas de autenticación:', error.message);
}

const cursoRoutes = require('./src/routes/cursoRoutes');
app.use('/api/cursos', cursoRoutes);

const asistenciaRoutes = require('./src/routes/asistenciaRoutes');
app.use('/api/asistencia', asistenciaRoutes);

app.use('/api/alumno', require('./src/routes/alumnoRoutes'));
app.use('/api/docente', require('./src/routes/docenteRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta API no encontrada' }));
const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Servidor Express corriendo en el puerto ${PORT}`);
  console.log(`=================================`);

  // Cierra automáticamente las sesiones cuyo horario ya venció
  // (reemplaza al botón manual "Cerrar Sesión" en la proyección).
  iniciarJobCierreAutomatico(wss);
});
