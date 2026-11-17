# Revisión del Sprint Backlog contra el código

Actualización: 17/11/2026.

Fuente: `Sprint Backlog (2).xlsx`, hoja `Sprint Backlog`. Se revisaron valores y fórmulas sin modificar el libro original. El estado «Hecho» del Excel no se tomó como evidencia de una prueba ejecutada.

## Pendientes funcionales

| Filas | Elemento | Evidencia actual y trabajo pendiente |
| --- | --- | --- |
| 76–79 | Reporte general del administrador | Implementado reporte general PDF/Excel desde el panel administrativo, con filtros de curso y fechas. Consolida cursos del periodo activo, sesiones cerradas y registros históricos, incluidos alumnos retirados. Pruebas locales de totales, permisos, archivos y modal aprobadas; pendiente recorrido en Render con la nueva versión. |
| 64 | Justificar todas las faltas de un rango | El usuario informa prueba satisfactoria. En este checkout, `enviarJustificacion` sigue recibiendo un único `asistencia_id`: la asociación automática de TODAS las faltas de un rango no está demostrada por este código. Conservar por separado la evidencia del flujo probado y el criterio literal de la fila 64. |
| 25 | Botón de cierre manual | Cerrado por acuerdo explícito del equipo: se usa cierre automático y no se solicita un botón de cierre manual. Registrar este ajuste del criterio de aceptación. |
| 74 | Filtros curso/fecha del dashboard administrativo | El panel consulta `obtenerResumenAdmin()` sin filtros. Los filtros del historial docente no completan este requisito del administrador. |
| 84 | Reprogramación docente | Implementada en esta revisión: programar clases pendientes, cambiar fecha/horario de la misma sección, validar periodo activo, propiedad y cruces del docente, y registrar horario anterior/nuevo y motivo en auditoría. No modifica clases activas/cerradas. La proyección activa la sesión programada al llegar su horario. Probada en PostgreSQL local y UI con API simulada; falta prueba desplegada. No requiere migración. |
| 56 | Pruebas end-to-end | El usuario confirma recorrido real satisfactorio, incluido navegador/celular. Registrar como evidencia reportada por el usuario, diferenciada de las pruebas automatizadas locales del agente. |
| 15, 42, 48, 65, 75 | Pruebas marcadas Hecho | Adjuntar evidencias por escenario. Las 12 pruebas actuales no demuestran por sí solas todos los roles, permisos y flujos de estas filas. |
| 9 | Recuperación por correo | La lógica existe, pero hay que verificar entrega real del OTP. El plan gratuito de Render bloquea los puertos SMTP habituales. |

## Filas que requieren actualizar la descripción o acreditar avance

- **52 y 54:** implementación y pruebas de integración aprobadas; el usuario confirma prueba real satisfactoria. Pueden cerrarse con esa evidencia.
- **55:** QR vencido y rostro distinto cubiertos por integración; el usuario confirma los escenarios de errores y cámara en navegador. Evidencia reportada por el usuario.
- **50:** el Excel dice `html5-qrcode`; el código usa `@zxing/browser`. Corregir el nombre de la biblioteca.
- **43–45:** la historia habla de autorregistro de alumno. La versión actual administra cuentas desde el administrador y permite al alumno autenticado registrar su rostro. Ajustar el criterio o completar autorregistro si sigue requerido.
- **68:** las alertas se evalúan al cierre de sesión, no mediante un job independiente. Documentar mínimo de cuatro sesiones y umbrales configurables.
- **80–83:** `CORRECCIONES-LIGHTHOUSE.pdf` sí contiene evidencia visual de accesibilidad 100 en login (dos capturas), cursos y directorio de docentes; rendimiento 96/98/99/99 respectivamente. Corresponde a la aplicación Full Stack de las capturas. Las correcciones de etiquetas, botón de contraseña y barra de ocupación faltantes en Integrador se trasladaron en esta revisión. Se reconoce el trabajo anterior; estas puntuaciones no constituyen una medición nueva de Integrador.
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

## Validación de esta revisión

- Backend: suite de 13 pruebas, con el flujo de integración docente ampliado para programación, reprogramación, conflicto de horarios, permisos, auditoría, protección de clases cerradas/activas, activación y reporte general. Datos locales transaccionales revertidos.
- Frontend: compilación TypeScript/Vite y ESLint aprobados.
- Chrome local, viewport de 360 px, API simulada: menú administrativo, formulario sin desbordamiento, diálogos de exportación/programación/detalle, recorrido Tab, Escape y retorno del foco.
- PDF general: muestra de 65 cursos, dos páginas renderizadas; Excel abierto con openpyxl y valores numéricos/acentos comprobados. Son datos sintéticos de verificación.
- Biometría: motor de 1,314 KB separado mediante importación dinámica; el módulo de captura JPEG pesa ~3 KB. El motor conserva su tamaño y se descarga al usar reconocimiento facial. No se midió duración real de cámara ni Lighthouse nuevo en celular.
- El manual y los PDF originales se conservan sin cambios. No se ejecutó SQL en Render ni se alteró la base compartida.

## Cierre del backlog

Reconocer las pruebas reportadas por el usuario (52, 54–56) y la evidencia Lighthouse anterior (80–83). Registrar el cierre por acuerdo de la fila 25. Las funciones nuevas 76–79 y 84 quedan implementadas y verificadas localmente; completar su recorrido en Render antes de certificar el despliegue. La fila 64 mantiene una diferencia entre la prueba reportada y el contrato de esta versión; no marcar una asociación por rango como comprobada leyendo un endpoint de una sola falta. El archivo Excel original no se modificó ni se inventaron horas.
