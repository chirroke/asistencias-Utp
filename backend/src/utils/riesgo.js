// Regla única de "riesgo por inasistencias" (la usan las alertas, el reporte y el panel del docente).
//   advertencia: faltas ≥ 20% (configurable con RIESGO_ADVERTENCIA_PCT)
//   crítico:     faltas ≥ umbral_riesgo_pct del curso (30% por defecto)
// Con pocas sesiones el porcentaje engaña (1 falta de 2 clases = 50%), por eso se exige un mínimo.
const ADVERTENCIA_PCT = Number(process.env.RIESGO_ADVERTENCIA_PCT) || 20;
const MIN_SESIONES = Number(process.env.RIESGO_MIN_SESIONES) || 4;

const redondear1 = (n) => Math.round(n * 10) / 10;

const clasificarRiesgo = (faltas, totalSesiones, umbralCurso) => {
  const critico = Number(umbralCurso) || 30;
  const advertencia = Math.min(ADVERTENCIA_PCT, critico);
  const porcentajeFaltas = totalSesiones ? redondear1((faltas * 100) / totalSesiones) : 0;
  let nivel = null;
  if (totalSesiones >= MIN_SESIONES) {
    if (porcentajeFaltas >= critico) nivel = 'critico';
    else if (porcentajeFaltas >= advertencia) nivel = 'advertencia';
  }
  return { nivel, porcentajeFaltas, advertenciaPct: advertencia, criticoPct: critico };
};

module.exports = { clasificarRiesgo, ADVERTENCIA_PCT, MIN_SESIONES };
