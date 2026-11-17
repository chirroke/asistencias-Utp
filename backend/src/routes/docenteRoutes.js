const express = require('express');
const router = express.Router();
const { verifyToken, verificarRol } = require('../middleware/authMiddleware');
const { uploadEvidence } = require('../middleware/uploadEvidence');
const { listarJustificaciones, resolverJustificacion } = require('../controllers/justificacionController');
const { reportarIncidencia, obtenerAlumnosEnRiesgo } = require('../controllers/docenteController');

const { listarProgramaciones, guardarProgramacion } = require('../controllers/programacionController');

router.use(verifyToken, verificarRol(['docente']));
router.get('/justificaciones', listarJustificaciones);
router.post('/justificaciones/:id/resolver', resolverJustificacion);
router.post('/incidencias', uploadEvidence, reportarIncidencia);
router.get('/riesgo', obtenerAlumnosEnRiesgo);
router.get('/cursos/:cursoId/programaciones', listarProgramaciones);
router.post('/cursos/:cursoId/programaciones', guardarProgramacion);

module.exports = router;
