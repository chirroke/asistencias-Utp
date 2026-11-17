# SistemaAsistenciaQR — correcciones integradas

Se mantuvo el diseño existente y se integraron cambios funcionales de la entrega de mejoras. No se incorporaron sus cambios globales de tema ni sus funciones de reprogramación.

## Cambios

- Registro y visualización de tardanza del alumno según la tolerancia del curso, contada desde la apertura de la sesión. La entrada docente sigue siendo un registro sin clasificación automática de tardanza.
- Reportes Excel/PDF desde el historial docente, con fechas, permisos por curso y distinción entre presentes, tardanzas, faltas y justificaciones. Un rango mayor de 120 sesiones se rechaza para evitar exportaciones incompletas.
- Alertas del alumno con confirmación de lectura y resumen de estudiantes en riesgo para el docente. La lista se vuelve a consultar al pulsar Actualizar.
- Validación centralizada de la configuración JWT en producción.
- Totales del panel del alumno calculados sobre sesiones cerradas, evitando contar una asistencia activa fuera del total de clases.
- Corrección de la prueba del docente para que las operaciones del controlador utilicen la misma transacción temporal.

## Verificación realizada

- `frontend`: `npm run build`, correcto. Vite conserva una advertencia de tamaño del paquete de biometría (aproximadamente 1,3 MB sin comprimir).
- ESLint sobre todo el frontend de la copia de publicación, sin errores.
- `backend`: `npm test`, 12 pruebas aprobadas. Incluye pruebas con consultas simuladas y dos flujos de integración contra PostgreSQL local.
- Integración del alumno: QR válido, duplicado, rostro distinto, token falso, tardanza, expiración, cierre, totales del reporte y cálculo de riesgo.
- Integración del docente: apertura, generación QR, ticket WebSocket, registro manual, lista en vivo, historial, detalle, entrada y cierre. El envío de eventos utiliza un cliente simulado.
- Las integraciones utilizan transacciones revertidas. No prueban la captura física de cámara ni una conexión WebSocket desde el navegador.
- Consulta de esquema local: existen `alerta_riesgo` con sus diez columnas y `asistencia.minutos_tardanza`. No fue necesario modificar esta base.

## Uso local

1. Conserva los archivos `.env` privados configurados para esta PC.
2. En `backend`, ejecuta `npm run dev`.
3. En otra terminal, dentro de `frontend`, ejecuta `npm run dev` y abre la dirección que indica Vite.
4. Docente: abre el historial de un curso, selecciona fechas y usa Exportar reporte.
5. La lista docente de riesgo muestra hasta cinco registros prioritarios. Las alertas se generan al cerrar sesiones; por defecto requieren cuatro sesiones cerradas, advertencia de 20% y nivel crítico según el umbral del curso.

Para otra base restaurada, consulta `backend/migrations/README.md`. Las migraciones requieren el esquema original; no sustituyen el respaldo completo. No copies dependencias `node_modules` entre equipos: instala desde los lockfiles con `npm ci` en cada carpeta.

## Pendiente de comprobación

- Recorrido visual en navegador y cámara real en PC/celular: QR, selfie, recepción de marcaciones y descarga de archivos.
- Apertura visual de los reportes en Excel y lector PDF.
- Creación de los recursos y verificación de despliegue en Render. La configuración está preparada; esta entrega no está desplegada allí.
- Las pruebas locales no demuestran funcionamiento en la laptop hasta configurar y comprobar su entorno.

## Preparación de publicación — 16 de noviembre de 2026

- Repositorio preparado conservando su historial y organizando el código en `frontend` y `backend`. Se excluyen entornos privados, registros y datos de alumnos.
- README con instalación y manual de los tres roles. `docs/REVISION_BACKLOG.md` registra las diferencias entre el Excel y la implementación; el Excel original se conserva.
- Esquema PostgreSQL sin registros, importado con éxito en una base temporal nueva. Seed con contraseña obligatoria proporcionada por variable de entorno, sin contraseña fija publicada.
- Verificación HTTP local: salud de API y PostgreSQL, rutas internas de la SPA, inicio de sesión de los tres roles y respuesta 404 de API. La base temporal fue eliminada al terminar.
- Las 12 pruebas del backend volvieron a pasar después de corregir el vencimiento de sesión, el token QR con caracteres multibyte y la lectura del rol vigente desde la base.
- Carga diferida de páginas: el paquete JavaScript inicial del build pasó de 389,77 KB a 261,75 KB (sin comprimir). El paquete de biometría mantiene la advertencia de tamaño. Esto no equivale a una medición Lighthouse.
- Idioma HTML, descripción, fuentes y etiquetas accesibles de botones revisados, conservando la apariencia existente.
- Dependencias actualizadas dentro de los rangos declarados mediante `npm audit fix`. La auditoría ejecutada no reportó vulnerabilidades del backend ni de las dependencias de producción del frontend.
- Render: servicio único para SPA, API y WebSocket; conexión mediante `DATABASE_URL`, secreto obligatorio en producción y `/api/health` con consulta a PostgreSQL. Configuración y pasos en `render.yaml` y `docs/RENDER.md`.

### Pendientes funcionales y de evidencia

- Reprogramaciones no están implementadas en esta versión; no se incorporó el módulo incompleto del paquete de mejoras.
- Justificación de varias asistencias en una solicitud y filtros globales del administrador siguen pendientes. Los reportes implementados son por curso.
- Cierre manual: existe endpoint; falta la acción en la interfaz docente.
- Incidencias y justificaciones requieren recorrido de extremo a extremo. No quedan cubiertas por las 12 pruebas como módulos completos.
- WebSocket real, cámara, biometría con personas, Lighthouse y servicio público en Render requieren verificación adicional. No se declaran aprobados.
