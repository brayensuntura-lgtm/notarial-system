const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const app = express();
app.use(cors());
app.use(express.json());
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDFs allowed'));
    cb(null, true);
  }
});
// Load processes from data file
let DB_PROCESSES = require('./data/processes.json');
function findProcessAndReq(processId, reqId) {
  const p = DB_PROCESSES.find(x => x.id === processId);
  if (!p) return {};
  const r = p.requirements.find(x => x.id === reqId);
  return { p, r };
}
app.get('/api/processes', (req, res) => {
  res.json(DB_PROCESSES);
});
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const { processId, requirementId, uploaderName } = req.body;
    const { p, r } = findProcessAndReq(processId, requirementId);
    if (!p || !r) return res.status(400).json({ error: 'invalid_target' });
    const rec = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      createdAt: new Date().toISOString(),
      url: `/files/${req.file.filename}`,
      uploaderName: uploaderName || null
    };
    r.uploads = r.uploads || [];
    r.uploads.push(rec);
    res.json(rec);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload_failed' });
  }
});
app.delete('/api/uploads/:id', (req, res) => {
  const id = req.params.id;
  for (const p of DB_PROCESSES) {
    for (const r of p.requirements) {
      const idx = (r.uploads || []).findIndex(x => x.id === id);
      if (idx !== -1) {
        const rec = r.uploads.splice(idx, 1)[0];
        fs.unlink(rec.path, () => {});
        return res.status(204).end();
      }
    }
  }
  res.status(404).json({ error: 'not_found' });
});
app.get('/files/:name', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
