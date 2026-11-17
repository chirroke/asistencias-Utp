const express = require('express');
const router = express.Router();
const { verifyToken, verificarRol } = require('../middleware/authMiddleware');
const { uploadEvidence, uploadSelfie } = require('../middleware/uploadEvidence');
const { obtenerResumen, registrarConQR, registrarRostroAlumno, enviarJustificacion, marcarAlertasLeidas } = require('../controllers/alumnoController');
const { descargarEvidencia } = require('../controllers/justificacionController');

router.use(verifyToken, verificarRol(['alumno']));
router.get('/resumen', obtenerResumen);
router.post('/alertas/leer-todas', marcarAlertasLeidas);
router.post('/alertas/:id/leer', marcarAlertasLeidas);
router.post('/perfil/rostro', uploadSelfie, registrarRostroAlumno);
router.post('/asistencia/escanear', uploadSelfie, registrarConQR);
router.post('/justificaciones', uploadEvidence, enviarJustificacion);
router.get('/justificaciones/:id/evidencia', descargarEvidencia);

module.exports = router;
