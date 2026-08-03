const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer();

app.use(express.json());

const documents = [];

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  return res.json({ token: 'mock-auth-token' });
});

app.post('/api/documents/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const document = {
    id: `${Date.now()}`,
    name: req.file.originalname,
    type: req.file.mimetype,
    status: 'Processing',
    uploadedAt: new Date().toISOString(),
  };

  documents.unshift(document);
  return res.json(document);
});

app.get('/api/documents', (req, res) => {
  return res.json(documents);
});

app.get('/api/documents/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const filtered = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(q) ||
      doc.type.toLowerCase().includes(q) ||
      doc.status.toLowerCase().includes(q),
  );
  return res.json(filtered);
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Mock backend listening on http://localhost:${port}`);
});
