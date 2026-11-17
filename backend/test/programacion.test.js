const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarHorario } = require('../src/controllers/programacionController');

test('programación: rechaza fechas inexistentes, pasadas, horas invertidas y datos no textuales', () => {
  const base = { fecha: new Date(Date.now()+86400000).toISOString().slice(0,10), horaInicio:'09:00', horaFin:'11:00', motivo:'Recuperación de clase' };
  assert.equal(validarHorario(base), null);
  for (const cambio of [
    { fecha:'2026-02-30' }, { fecha:'2000-01-01' }, { horaFin:'08:00' },
    { horaInicio:'25:00' }, { horaInicio:['09:00'] }, { motivo:'abc' },
  ]) assert.ok(validarHorario({ ...base,...cambio }));
});
