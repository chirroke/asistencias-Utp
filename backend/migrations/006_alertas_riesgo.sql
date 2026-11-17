-- Alertas de riesgo por inasistencias. Es idempotente: si tu BD ya tiene la tabla (como en el backup), no cambia nada.
ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS minutos_tardanza integer;
DO $$ BEGIN
  CREATE TYPE nivel_alerta AS ENUM ('advertencia', 'critico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alerta_riesgo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES alumno(usuario_id),
  curso_id uuid NOT NULL REFERENCES curso(id),
  nivel nivel_alerta NOT NULL,
  porcentaje_asistencia numeric(5,2) NOT NULL CHECK (porcentaje_asistencia BETWEEN 0 AND 100),
  umbral_aplicado numeric(5,2) NOT NULL CHECK (umbral_aplicado BETWEEN 0 AND 100),
  leida boolean NOT NULL DEFAULT FALSE,
  leida_en timestamptz,
  generada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alerta_alumno ON alerta_riesgo (alumno_id);
CREATE INDEX IF NOT EXISTS idx_alerta_curso ON alerta_riesgo (curso_id);
