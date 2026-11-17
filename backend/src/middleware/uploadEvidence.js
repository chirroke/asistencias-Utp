const multer = require('multer');

const selfieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== 'image/jpeg') return callback(new Error('La selfie debe ser una imagen JPEG.'));
    callback(null, true);
  },
});

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) return callback(new Error('Adjunta un PDF, JPG o PNG de hasta 5 MB.'));
    callback(null, true);
  },
});

const validateEvidenceSignature = (file) => {
  if (!file) return false;
  const data = file.buffer;
  if (file.mimetype === 'application/pdf') return data.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  return false;
};

const uploadEvidence = (req, res, next) => evidenceUpload.single('evidencia')(req, res, (error) => {
  if (error) return res.status(400).json({ error: error.message });
  next();
});

const uploadSelfie = (req, res, next) => selfieUpload.single('selfie')(req, res, (error) => {
  if (error) return res.status(400).json({ error: error.message });
  next();
});

const validateSelfieSignature = (file) => Boolean(file && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff);

module.exports = { uploadEvidence, uploadSelfie, validateEvidenceSignature, validateSelfieSignature };
