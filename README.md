# SistemaAsistenciaQR — Integrador II

Aplicación web para registrar asistencia mediante QR dinámico y comparación facial, con vistas de alumno, docente y administrador. El frontend utiliza React, TypeScript y Vite. El backend utiliza Node.js, Express, WebSocket (`ws`) y PostgreSQL.

## Funciones disponibles

- Inicio de sesión con JWT, permisos por rol y cambio de contraseña.
- Directorio de docentes activos/inactivos, registro de alumnos, retiro de matrículas y consulta de cursos.
- Apertura de clase, proyección de QR renovado cada 20 segundos y asistencia en vivo.
- Registro facial del alumno, escaneo QR, selfie y clasificación de asistencia/tardanza.
- Marcación manual por contingencia y cierre de clase con registro de faltas.
- Justificación de una falta con PDF/JPG/PNG y revisión del docente.
- Historial y reportes de un curso en Excel/PDF, desde el historial docente.
- Alertas de inasistencia y seguimiento de estudiantes en riesgo.

La biometría usa descriptores de 128 valores calculados en el navegador y comparación en el backend. No implementa prueba de vida ni geolocalización. El registro de entrada docente no clasifica automáticamente tardanzas. El reporte general de todos los cursos, la justificación masiva y la reprogramación siguen pendientes. Véase [revisión del backlog](docs/REVISION_BACKLOG.md).

## Estructura

```text
backend/       API, validaciones, migraciones y pruebas
frontend/      Aplicación React y modelos faciales
database/      Esquema inicial sin datos personales
docs/          Despliegue y revisión del Sprint Backlog
render.yaml    Configuración del servicio web en Render
```

## Instalación local (Windows)

Requisitos: Git, Node.js 22 (22.12 o superior de esa rama), npm y PostgreSQL 18. pgAdmin es opcional. La cámara necesita HTTPS o `localhost`.

```powershell
git clone https://github.com/chirroke/asistencias-Utp.git
cd asistencias-Utp
npm ci --prefix backend
npm ci --prefix frontend
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Edita `backend/.env`: configura `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Mantén `DATABASE_URL` vacío para usar esos campos. Genera una clave privada para `JWT_SECRET` con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` y guárdala únicamente en el archivo de entorno.

### Base nueva

Desde la raíz del repositorio, crea una base vacía y carga el esquema:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h localhost -U postgres asistencia
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d asistencia -v ON_ERROR_STOP=1 --single-transaction -f database/schema.sql
```

El esquema se ejecuta con `psql`: contiene comandos como `\restrict` que pgAdmin Query Tool no interpreta. El archivo no contiene usuarios, contraseñas, fotos ni asistencias reales. Si ya restauraste una base existente, conserva sus datos y sigue [las migraciones](backend/migrations/README.md), en lugar de volver a cargar el esquema inicial.

### Cuentas de demostración

Solo en una base destinada a demostración, define localmente `DEMO_PASSWORD` con al menos 12 caracteres y ejecuta `npm run seed:demo --prefix backend`. La variable puede guardarse temporalmente en `backend/.env`. El script crea o actualiza las cuentas demo y reemplaza sus contraseñas; no debe ejecutarse como parte de cada despliegue.

| Rol | Cuenta demo |
| --- | --- |
| Administrador | `admin.demo@utp.edu.pe` |
| Docente | `docente.demo@utp.edu.pe` |
| Alumno | `u20267184@utp.edu.pe` |

La contraseña es la que hayas definido en `DEMO_PASSWORD`. Los alumnos deben registrar su rostro desde su propia cuenta.

### Iniciar

En una terminal:

```powershell
npm run dev --prefix backend
```

En otra:

```powershell
npm run dev --prefix frontend
```

Abre la URL mostrada por Vite, normalmente `http://localhost:5173`. El proxy de Vite dirige `/api` y `/ws` al backend local. `http://localhost:3000/api/health` devuelve estado de conexión a PostgreSQL.

Para ejecutar la versión compilada en una sola dirección:

```powershell
npm run build
npm start
```

Abre `http://localhost:3000`. Express sirve el frontend compilado, la API y WebSocket.

## Manual de usuario

### Acceso

1. Ingresa el correo y la contraseña de tu cuenta activa.
2. El sistema abre la vista correspondiente al rol. Usa la opción de cambio de contraseña para actualizarla.
3. La recuperación por código requiere un servicio de correo configurado; no basta con mostrar el formulario.

### Administrador

1. Revisa los indicadores en el panel principal.
2. En Docentes, consulta el directorio y actualiza su estado activo/inactivo.
3. En Alumnos, registra estudiantes con sus cursos y retira matrículas cuando corresponda.
4. En Cursos, consulta secciones, docentes asignados, aforo e historial. La creación de cursos, docentes y períodos se prepara actualmente en la base o con el seed de demostración; no hay formularios completos para ello.
5. Revisa las incidencias técnicas enviadas por docentes y los archivos de sustento.

### Docente

1. Abre Mis Cursos y selecciona **Aperturar sesión y proyectar QR**. Si hay una sesión activa, usa **Continuar proyección**.
2. Proyecta el QR en el aula. La pantalla lo renueva y muestra las marcaciones en vivo.
3. Registra tu entrada desde el panel cuando la clase esté activa. Para problemas del aula, usa **Reportar problema del aula** y adjunta evidencia.
4. Ante una contingencia de un alumno presente, usa el registro manual y explica el motivo.
5. La sesión se cierra automáticamente al vencer su horario. Los alumnos sin marcación reciben falta. El backend también dispone de cierre manual, pero la pantalla de proyección actual no muestra un botón para ejecutarlo.
6. En **Historial**, selecciona fechas y consulta el detalle. Usa **Exportar reporte** para descargar Excel o PDF de las sesiones cerradas del curso. El botón deshabilitado en la pantalla de proyección no es la entrada a esta función.
7. En **Bandeja de justificaciones**, abre el sustento y aprueba o rechaza la solicitud. Al aprobarla, la falta vinculada pasa a justificada.
8. Consulta la lista de alumnos en riesgo y pulsa **Actualizar** para renovar sus datos.

### Alumno

1. En **Perfil**, entra a **Registrar foto facial**. Permite la cámara, centra un solo rostro y toma la fotografía con iluminación suficiente.
2. Cuando el docente abra la clase, en **Inicio** pulsa **Marcar Asistencia a Clase**.
3. Escanea el QR vigente, captura la selfie y espera la confirmación. Si vence el QR, escanea el nuevo. Una segunda marcación se rechaza.
4. El registro se clasifica como presente o tardanza según la tolerancia del curso desde el inicio de la sesión.
5. En **Reporte**, selecciona el curso para consultar el historial de sesiones cerradas. El récord oficial PDF del alumno aún está deshabilitado.
6. En **Justificar**, selecciona el curso y una falta, escribe el motivo y adjunta un PDF/JPG/PNG de hasta 5 MB. La solicitud queda pendiente de revisión.
7. Revisa las alertas de inasistencia y pulsa **Entendido** para marcarlas como leídas. Son avisos del sistema, no una resolución académica oficial.

Las alertas persistentes se evalúan al cerrar sesiones. Por defecto se generan desde cuatro sesiones cerradas, con advertencia desde 20% de faltas y nivel crítico según el umbral del curso. El resumen global del alumno agrega sus cursos; para seguimiento de un curso utiliza su reporte individual.

## Comprobaciones

```powershell
npm test --prefix backend
npm run build --prefix frontend
```

La suite contiene pruebas unitarias y pruebas de integración que requieren la base configurada. Las integraciones crean datos temporales y revierten sus transacciones. La ejecución local aprobó 12 pruebas antes de la publicación; no sustituye la comprobación de cámara y navegador en el servidor publicado.

## Despliegue y problemas frecuentes

Sigue [la guía de Render](docs/RENDER.md).

| Problema | Acción |
| --- | --- |
| Error cerca de `\restrict` | Ejecuta el archivo de esquema o respaldo Plain con `psql`, no con Query Tool. |
| `/api/health` devuelve 503 | Revisa la conexión privada a PostgreSQL y que el servicio esté disponible. |
| Cámara denegada | Permite la cámara y usa HTTPS o localhost. En un celular, localhost apunta al propio celular. |
| QR vencido | Escanea el QR recién proyectado y verifica conexión y hora del servidor. |
| Error CORS | Configura `FRONTEND_ORIGINS` con el origen exacto del sitio, sin ruta ni barra final. |
| No llegan códigos de recuperación | Revisa SMTP. Render Free bloquea los puertos SMTP habituales. |
| No aparecen cursos | Verifica período activo, docente asignado y matrícula activa. |

No publiques `.env`, respaldos con datos reales ni archivos de evidencia. Los modelos faciales del frontend sí forman parte del código distribuido.
