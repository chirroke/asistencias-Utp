# Revisión del Sprint Backlog contra el código

Fuente: `Sprint Backlog (2).xlsx`, hoja `Sprint Backlog`. Se revisaron valores y fórmulas sin modificar el libro original. El estado «Hecho» del Excel no se tomó como evidencia de una prueba ejecutada.

## Pendientes funcionales

| Filas | Elemento | Evidencia actual y trabajo pendiente |
| --- | --- | --- |
| 76–79 | Reporte general del administrador | Existe reporte PDF/Excel por curso en `reporteController.js` y modal en el historial docente. Falta consolidación de todos los cursos y acceso desde la interfaz administrativa. Mantener pendiente la HU14 completa. |
| 64 | Justificar todas las faltas de un rango | Figura Hecho, pero `enviarJustificacion` recibe un `asistencia_id` y el formulario selecciona una falta. Falta selección de rango/múltiples faltas y sus pruebas. |
| 25 | Botón de cierre manual | Figura Hecho. El endpoint y su prueba existen; la pantalla de proyección usa cierre automático y no muestra ese botón. Cambiar el estado o implementar el control si sigue dentro del alcance. |
| 74 | Filtros curso/fecha del dashboard administrativo | El panel consulta `obtenerResumenAdmin()` sin filtros. Los filtros del historial docente no completan este requisito del administrador. |
| 84 | Reprogramación docente | Está pendiente en Excel y ausente de esta versión. Su incorporación requiere confirmar el alcance, ya que se retiró del proyecto actual. |
| 56 | Pruebas end-to-end | Mantener En Curso. Las integraciones verifican controladores y PostgreSQL con datos temporales; falta navegador/cámara física/HTTPS y conexión WebSocket real. |
| 15, 42, 48, 65, 75 | Pruebas marcadas Hecho | Adjuntar evidencias por escenario. Las 12 pruebas actuales no demuestran por sí solas todos los roles, permisos y flujos de estas filas. |
| 9 | Recuperación por correo | La lógica existe, pero hay que verificar entrega real del OTP. El plan gratuito de Render bloquea los puertos SMTP habituales. |

## Filas que requieren actualizar la descripción o acreditar avance

- **52 y 54:** QR y registro presente/tardanza ya tienen implementación y prueba de integración aprobada. Se puede actualizar su avance técnico, diferenciándolo de la prueba end-to-end.
- **55:** se prueban QR vencido y rostro distinto; falta acreditar cámara denegada en un navegador real.
- **50:** el Excel dice `html5-qrcode`; el código usa `@zxing/browser`. Corregir el nombre de la biblioteca.
- **43–45:** la historia habla de autorregistro de alumno. La versión actual administra cuentas desde el administrador y permite al alumno autenticado registrar su rostro. Ajustar el criterio o completar autorregistro si sigue requerido.
- **68:** las alertas se evalúan al cierre de sesión, no mediante un job independiente. Documentar mínimo de cuatro sesiones y umbrales configurables.
- **80–83:** hay cambios de interfaz, pero hace falta evidencia Lighthouse actual sobre la URL desplegada; no se infiere una puntuación por leer el código.
- **6:** el responsable es Jorge. Confirmar que corresponde al equipo y a su participación real, sin sustituirlo automáticamente.

## Inconsistencias de horas y fórmulas

- Hay **79 tareas**: 70 con estado Hecho, 4 En Curso y 5 Pendiente (normalizando mayúsculas). Son los estados escritos en el Excel, no una certificación de cumplimiento.
- Las estimaciones de `G6:G84` suman **303 horas** y los consumos diarios registrados suman **221 horas**. La diferencia aritmética es **82 horas**, sin incluir estimaciones ausentes.
- Los totales restantes guardados en `BQ` suman **78 horas**. Faltan las 4 horas de la fila 9 porque `BP9` y `BQ9` están vacías y su cadena diaria de fórmulas se interrumpe después de `R9`.
- La fila **9** y las filas **43–56** no registran horas consumidas, aunque varias están marcadas Hecho. Registrar las horas reales; no inventarlas para cuadrar el total.
- La fila **20** estima 4 h y registra 3 h, quedando 1 h con estado Hecho. Puede ser ahorro real, pero la fórmula restante no lo distingue de trabajo pendiente.
- La fila **30** estima 5 h y registra 6 h: produce −1 h restante. Registrar ese valor como desviación de estimación, no como trabajo negativo pendiente.
- Las filas **80–84** no tienen estimaciones ni fórmulas de seguimiento. Completar con las cifras acordadas por el equipo.
- Uniformar `hecho`/`Hecho`, identificar el Sprint y sus fechas, y adjuntar criterios de aceptación y enlaces de evidencia por historia.

## Orden sugerido de cierre

1. Publicación y recorrido HTTPS en los tres roles.
2. Reporte administrativo general.
3. Justificación de varias faltas y filtros administrativos.
4. Resolver el alcance del cierre manual y la reprogramación.
5. Evidencias de cámara, permisos, recuperación de contraseña y Lighthouse.
6. Actualizar estados y horas del Excel con evidencia y registros reales.
