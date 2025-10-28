const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let whatsappManager = null;
let isManagerInitialized = false;

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  }
});

function getUserDataPath(...pathSegments) {
  return path.join(__dirname, '.config', 'whatsapp-blast-manager', ...pathSegments);
}

function ensureDirectoriesExist() {
  const dirs = [
    getUserDataPath('sessions'),
    getUserDataPath('database'),
    getUserDataPath('logs'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'public')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

async function initializeWhatsAppManager() {
  try {
    console.log('Initializing WhatsApp Manager...');
    ensureDirectoriesExist();
    
    const WhatsappManager = require('./services/whatsapp-manager');
    whatsappManager = new WhatsappManager({
      sessionsDir: getUserDataPath('sessions'),
      databaseDir: getUserDataPath('database'),
      isDev: process.env.NODE_ENV === 'development'
    });
    
    whatsappManager.on('sessionStatusChanged', () => {
      console.log('Session status changed, broadcasting update...');
      broadcastSessionUpdate();
    });
    
    await whatsappManager.initialize();
    isManagerInitialized = true;
    console.log('WhatsApp Manager initialized successfully');
    
    setInterval(() => {
      broadcastSessionUpdate();
    }, 5000);
    
  } catch (error) {
    console.error('Failed to initialize WhatsApp Manager:', error);
    isManagerInitialized = false;
  }
}

function ensureManagerInitialized() {
  if (!isManagerInitialized || !whatsappManager) {
    throw new Error('WhatsApp Manager is not initialized yet. Please wait a moment and try again.');
  }
}

function broadcastSessionUpdate() {
  if (isManagerInitialized && whatsappManager) {
    try {
      const sessions = whatsappManager.getAllSessions();
      io.emit('sessions-updated', sessions);
    } catch (error) {
      console.error('Error broadcasting session updates:', error);
    }
  }
}

app.get('/api/manager/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isInitialized: isManagerInitialized,
      hasManager: !!whatsappManager,
      isDev: process.env.NODE_ENV === 'development'
    }
  });
});

app.get('/api/sessions', (req, res) => {
  try {
    ensureManagerInitialized();
    const sessions = whatsappManager.getAllSessions();
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    ensureManagerInitialized();
    
    const { userId = 1, type = 'qr', phoneNumber, sessionName } = req.body;
    
    if (!sessionName) {
      return res.status(400).json({ success: false, error: 'Session name is required' });
    }
    
    if (type === 'pairing' && !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required for pairing' });
    }
    
    const result = await whatsappManager.createSession(userId, type, phoneNumber, sessionName);
    
    setTimeout(broadcastSessionUpdate, 1000);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sessions/:sessionId/logout', async (req, res) => {
  try {
    ensureManagerInitialized();
    
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    
    const result = await whatsappManager.logoutSession(sessionId);
    setTimeout(broadcastSessionUpdate, 1000);
    res.json({ success: result });
  } catch (error) {
    console.error('Logout session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages/send', async (req, res) => {
  try {
    ensureManagerInitialized();
    
    const { sessionId, recipient, message } = req.body;
    
    if (!sessionId || !recipient || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID, recipient, and message are required' 
      });
    }
    
    const result = await whatsappManager.sendTextMessage(sessionId, recipient, message);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages/blast', async (req, res) => {
  try {
    ensureManagerInitialized();
    
    const { contacts, message, sessionIds } = req.body;
    
    if (!Array.isArray(contacts) || !message || !Array.isArray(sessionIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Contacts, message, and session IDs are required' 
      });
    }
    
    if (contacts.length === 0) {
      return res.status(400).json({ success: false, error: 'No contacts provided' });
    }
    
    if (sessionIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No sessions selected' });
    }
    
    console.log(`Starting blast message to ${contacts.length} contacts using ${sessionIds.length} sessions`);
    
    const result = await whatsappManager.blastMessage(contacts, message, sessionIds);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Blast message error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/contacts/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const contacts = XLSX.utils.sheet_to_json(worksheet);
      
      if (!Array.isArray(contacts) || contacts.length === 0) {
        throw new Error('No valid contacts found in the file');
      }
      
      fs.unlinkSync(filePath);
      
      console.log(`Imported ${contacts.length} contacts`);
      res.json({ success: true, data: contacts });
    } catch (parseError) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw parseError;
    }
  } catch (error) {
    console.error('Import contacts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:sessionId/status', async (req, res) => {
  try {
    ensureManagerInitialized();
    
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    
    const isConnected = whatsappManager.isSessionConnected(sessionId);
    res.json({ success: true, data: { isConnected } });
  } catch (error) {
    console.error('Check session status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  if (isManagerInitialized && whatsappManager) {
    const sessions = whatsappManager.getAllSessions();
    socket.emit('sessions-updated', sessions);
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

async function start() {
  await initializeWhatsAppManager();
  
  server.listen(PORT, HOST, () => {
    console.log(`WhatsApp Blast Manager server running on http://${HOST}:${PORT}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
