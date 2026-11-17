const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) {
  throw new Error('Define DEMO_PASSWORD con al menos 12 caracteres antes de ejecutar seed:demo.');
}
const users = [
  { correo: 'admin.demo@utp.edu.pe', nombres: 'Admin', apellidos: 'Demo', rol: 'admin' },
  { correo: 'docente.demo@utp.edu.pe', nombres: 'Docente', apellidos: 'Demo', rol: 'docente' },
  { correo: 'u20267184@utp.edu.pe', nombres: 'Alex', apellidos: 'Rivera', rol: 'alumno', codigo: 'U20267184' },
  { correo: 'u20263827@utp.edu.pe', nombres: 'Camila', apellidos: 'Soto', rol: 'alumno', codigo: 'U20263827' },
  { correo: 'u20269513@utp.edu.pe', nombres: 'Diego', apellidos: 'Vega', rol: 'alumno', codigo: 'U20269513' },
  { correo: 'u20262469@utp.edu.pe', nombres: 'Lucia', apellidos: 'Paredes', rol: 'alumno', codigo: 'U20262469' },
  { correo: 'u20265908@utp.edu.pe', nombres: 'Mateo', apellidos: 'Rojas', rol: 'alumno', codigo: 'U20265908' },
  { correo: 'u20268376@utp.edu.pe', nombres: 'Sofia', apellidos: 'Mendoza', rol: 'alumno', codigo: 'U20268376' },
];

const courses = [
  { id: 'a0000000-0000-4000-8000-000000000001', codigo: 'IS-401', nombre: 'Ingenieria de Software', seccion: '01' },
  { id: 'a0000000-0000-4000-8000-000000000002', codigo: 'IS-402', nombre: 'Base de Datos', seccion: '01' },
  { id: 'a0000000-0000-4000-8000-000000000003', codigo: 'IS-403', nombre: 'Programacion Web', seccion: '01' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userIds = new Map();

    for (const user of users) {
      const { rows } = await client.query(
        `INSERT INTO usuario (correo, contrasena_hash, nombres, apellidos, rol)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (correo) DO UPDATE SET
           contrasena_hash = EXCLUDED.contrasena_hash,
           nombres = EXCLUDED.nombres,
           apellidos = EXCLUDED.apellidos,
           rol = EXCLUDED.rol,
           activo = TRUE,
           eliminado_en = NULL
         RETURNING id`,
        [user.correo, passwordHash, user.nombres, user.apellidos, user.rol]
      );
      userIds.set(user.correo, rows[0].id);

      if (user.codigo) {
        await client.query(
          `INSERT INTO alumno (usuario_id, codigo_alumno)
           VALUES ($1, $2)
           ON CONFLICT (usuario_id) DO UPDATE SET codigo_alumno = EXCLUDED.codigo_alumno`,
          [rows[0].id, user.codigo]
        );
      }
    }

    const { rows: periodRows } = await client.query(
      `INSERT INTO periodo_academico (codigo, fecha_inicio, fecha_fin, activo)
       VALUES ('2026-II', '2026-08-01', '2026-12-31', TRUE)
       ON CONFLICT (codigo) DO UPDATE SET
         fecha_inicio = EXCLUDED.fecha_inicio,
         fecha_fin = EXCLUDED.fecha_fin,
         activo = TRUE
       RETURNING id`
    );

    for (const course of courses) {
      await client.query(
        `INSERT INTO curso
           (id, periodo_id, docente_id, codigo, nombre, seccion,
            tolerancia_marcado_min, tolerancia_tardanza_min, umbral_riesgo_pct, capacidad_alumnos)
         VALUES ($1, $2, $3, $4, $5, $6, 15, 15, 30, 5)
         ON CONFLICT (id) DO UPDATE SET
           periodo_id = EXCLUDED.periodo_id,
           docente_id = EXCLUDED.docente_id,
           codigo = EXCLUDED.codigo,
           nombre = EXCLUDED.nombre,
           seccion = EXCLUDED.seccion,
           capacidad_alumnos = EXCLUDED.capacidad_alumnos,
           eliminado_en = NULL`,
        [course.id, periodRows[0].id, userIds.get('docente.demo@utp.edu.pe'), course.codigo, course.nombre, course.seccion]
      );
    }

    const primaryCourse = courses[0].id;
    const secondCourse = courses[1].id;
    const thirdCourse = courses[2].id;
    const enrollments = [
      ...users.filter((user) => user.codigo).slice(0, 5).map((user) => ({ user, courseId: primaryCourse, state: 'activa' })),
      { user: users.find((user) => user.codigo === 'U20268376'), courseId: primaryCourse, state: 'retirada' },
      ...users.filter((user) => ['U20267184', 'U20263827', 'U20269513'].includes(user.codigo)).map((user) => ({ user, courseId: secondCourse, state: 'activa' })),
      ...users.filter((user) => ['U20262469', 'U20265908'].includes(user.codigo)).map((user) => ({ user, courseId: thirdCourse, state: 'activa' })),
    ];

    for (const enrollment of enrollments) {
      const alumnoId = userIds.get(enrollment.user.correo);
      await client.query(
        `UPDATE matricula
         SET estado = $3::estado_matricula,
             retirada_en = CASE WHEN $3::text = 'retirada' THEN COALESCE(retirada_en, now()) ELSE NULL END
         WHERE curso_id = $1 AND alumno_id = $2`,
        [enrollment.courseId, alumnoId, enrollment.state]
      );
      await client.query(
        `INSERT INTO matricula (curso_id, alumno_id, estado, retirada_en)
         SELECT $1, $2, $3::estado_matricula, CASE WHEN $3::text = 'retirada' THEN now() END
         WHERE NOT EXISTS (
           SELECT 1 FROM matricula WHERE curso_id = $1 AND alumno_id = $2
         )`,
        [enrollment.courseId, alumnoId, enrollment.state]
      );
    }

    const docenteId = userIds.get('docente.demo@utp.edu.pe');
    const alumnosDemo = users.filter((user) => user.codigo).slice(0, 5);
    const sesionesDemo = [
      { id: 'c0000000-0000-4000-8000-000000000001', diasAtras: 2 },
      { id: 'c0000000-0000-4000-8000-000000000002', diasAtras: 1 },
    ];
    for (const sesion of sesionesDemo) {
      await client.query(
        `INSERT INTO sesion_clase
           (id, curso_id, fecha, hora_inicio, hora_fin_programada, hora_cierre_real,
            estado, tipo_cierre, cerrada_por, tolerancia_marcado_min, tolerancia_tardanza_min, creado_por)
         VALUES ($1, $2, CURRENT_DATE - $3::int,
                 (CURRENT_DATE - $3::int + time '09:00')::timestamptz,
                 (CURRENT_DATE - $3::int + time '10:00')::timestamptz,
                 (CURRENT_DATE - $3::int + time '10:00')::timestamptz,
                 'cerrada', 'manual', $4, 15, 15, $4)
         ON CONFLICT (id) DO UPDATE SET
           curso_id = EXCLUDED.curso_id, fecha = EXCLUDED.fecha,
           hora_inicio = EXCLUDED.hora_inicio, hora_fin_programada = EXCLUDED.hora_fin_programada,
           hora_cierre_real = EXCLUDED.hora_cierre_real, estado = EXCLUDED.estado,
           tipo_cierre = EXCLUDED.tipo_cierre, cerrada_por = EXCLUDED.cerrada_por,
           tolerancia_marcado_min = EXCLUDED.tolerancia_marcado_min,
           tolerancia_tardanza_min = EXCLUDED.tolerancia_tardanza_min`,
        [sesion.id, primaryCourse, sesion.diasAtras, docenteId]
      );
    }

    const estadosPorSesion = [
      ['presente', 'falta', 'tardanza', 'falta', 'presente'],
      ['presente', 'presente', 'presente', 'justificada', 'presente'],
    ];
    for (let sesionIndex = 0; sesionIndex < sesionesDemo.length; sesionIndex += 1) {
      for (let alumnoIndex = 0; alumnoIndex < alumnosDemo.length; alumnoIndex += 1) {
        const estado = estadosPorSesion[sesionIndex][alumnoIndex];
        await client.query(
          `INSERT INTO asistencia (sesion_id, alumno_id, estado, origen, minutos_tardanza, creado_por)
           VALUES ($1, $2, $3, 'manual_docente', $4, $5)
           ON CONFLICT (sesion_id, alumno_id) DO UPDATE SET
             estado = EXCLUDED.estado, origen = EXCLUDED.origen,
             minutos_tardanza = EXCLUDED.minutos_tardanza, actualizado_en = now(), actualizado_por = EXCLUDED.creado_por`,
          [sesionesDemo[sesionIndex].id, userIds.get(alumnosDemo[alumnoIndex].correo), estado, estado === 'tardanza' ? 20 : null, docenteId]
        );
      }
    }

    await client.query(
      `INSERT INTO sesion_clase
         (id, curso_id, fecha, hora_inicio, hora_fin_programada, estado,
          tolerancia_marcado_min, tolerancia_tardanza_min, qr_ventana_seg, qr_secreto, creado_por)
       VALUES ('c0000000-0000-4000-8000-000000000003', $1, CURRENT_DATE, now() - interval '10 minutes',
               now() + interval '2 hours', 'activa', 15, 15, 20, encode(gen_random_bytes(32), 'hex'), $2)
       ON CONFLICT (id) DO UPDATE SET
         curso_id = EXCLUDED.curso_id, fecha = EXCLUDED.fecha, hora_inicio = EXCLUDED.hora_inicio,
         hora_fin_programada = EXCLUDED.hora_fin_programada, hora_cierre_real = NULL,
         estado = 'activa', tipo_cierre = NULL, cerrada_por = NULL,
         tolerancia_marcado_min = EXCLUDED.tolerancia_marcado_min,
         tolerancia_tardanza_min = EXCLUDED.tolerancia_tardanza_min,
         qr_ventana_seg = EXCLUDED.qr_ventana_seg, qr_secreto = EXCLUDED.qr_secreto,
         token_qr = NULL, expira_en = NULL, actualizado_en = now(), actualizado_por = EXCLUDED.creado_por`,
      [primaryCourse, docenteId]
    );

    await client.query('COMMIT');
    console.log('Datos de demo listos: 3 cursos, 5 alumnos activos en IS-401, 1 matricula retirada, 2 sesiones historicas con estados variados y 1 sesion QR activa.');
    console.log('Las cuentas utilizan la clave privada indicada en DEMO_PASSWORD.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('No se pudieron cargar los datos de demo:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
