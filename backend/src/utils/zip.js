// Empaquetador ZIP mínimo (método "deflate") para generar archivos .xlsx sin dependencias externas.
const zlib = require('zlib');

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// Fecha/hora DOS que exige el formato ZIP.
const fechaDos = (fecha) => ({
  hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1),
  dia: ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
});

/** @param {{nombre: string, contenido: Buffer|string}[]} archivos */
const crearZip = (archivos, fecha = new Date()) => {
  const { hora, dia } = fechaDos(fecha);
  const partes = [];
  const central = [];
  let posicion = 0;

  for (const archivo of archivos) {
    const nombre = Buffer.from(archivo.nombre, 'utf8');
    const original = Buffer.isBuffer(archivo.contenido) ? archivo.contenido : Buffer.from(archivo.contenido, 'utf8');
    const comprimido = zlib.deflateRawSync(original);
    const crc = crc32(original);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // versión mínima
    local.writeUInt16LE(0x0800, 6);    // nombres en UTF-8
    local.writeUInt16LE(8, 8);         // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(original.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    partes.push(local, nombre, comprimido);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt16LE(hora, 12);
    entrada.writeUInt16LE(dia, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(original.length, 24);
    entrada.writeUInt16LE(nombre.length, 28);
    entrada.writeUInt32LE(posicion, 42);
    central.push(entrada, nombre);

    posicion += local.length + nombre.length + comprimido.length;
  }

  const tamanoCentral = central.reduce((suma, parte) => suma + parte.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamanoCentral, 12);
  fin.writeUInt32LE(posicion, 16);
  return Buffer.concat([...partes, ...central, fin]);
};

module.exports = { crearZip, crc32 };
