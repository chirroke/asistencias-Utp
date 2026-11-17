# Actualizaciones de base de datos

pgAdmin 4 es el cliente para administrar PostgreSQL; no es necesario actualizarlo para instalar cambios del sistema. Las migraciones modifican la base PostgreSQL a la que se conecta el backend.

Estas migraciones requieren una base con el esquema original del proyecto ya restaurado. No crean una base completa desde cero. Conserva el respaldo antes de actualizar y verifica la base seleccionada en pgAdmin.

Para una base existente, abre en pgAdmin la base configurada en `backend/.env`, abre Query Tool y ejecuta los archivos completos en este orden:

1. `001_password_reset.sql`
2. `002_student_teacher_admin.sql`
3. `003_course_capacity.sql`
4. `004_attendance_selfie.sql`
5. `005_qr_biometria_schema_para_pgadmin.sql`
6. `006_alertas_riesgo.sql`

La segunda migración agrega los campos de evidencia para justificaciones, el registro independiente de incidencias docentes y el origen `qr_dinamico` para las asistencias escaneadas por alumnos. La tercera establece la capacidad de demo de cinco matrículas por curso. La cuarta agrega la foto JPEG de la marcación para mostrarla al docente en la lista en vivo. Las migraciones son aditivas y no eliminan datos existentes.

Después de ejecutar cada archivo, revisa la pestaña **Messages** y actualiza el árbol de objetos de pgAdmin. No compartas el archivo `.env`; contiene la conexión privada a la base.

La quinta migración prepara las columnas de QR y biometría. La sexta agrega las alertas. Los reportes y tardanzas también requieren las columnas originales `curso.tolerancia_marcado_min`, `curso.umbral_riesgo_pct` y `asistencia.minutos_tardanza`; la última se agrega si falta al ejecutar la sexta migración.

Las alertas se calculan al cerrar una sesión. Por defecto se evalúan desde cuatro sesiones cerradas, con advertencia desde 20% de faltas y nivel crítico según el umbral del curso (30% por defecto). Son indicadores de seguimiento del sistema.
