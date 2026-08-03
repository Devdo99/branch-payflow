import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFolder = path.join(__dirname, 'auth_session');

let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'

// Helper to clear Baileys session folder
function clearSession() {
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log('Session folder cleared.');
    } catch (err) {
      console.error('Failed to clear session folder:', err);
    }
  }
}

// Main connection logic
async function connectToWhatsApp() {
  console.log('Initializing WhatsApp connection...');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  
  try {
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'silent' }),
    });
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        connectionStatus = 'disconnected';
        try {
          qrCode = await qrcode.toDataURL(qr);
          console.log('New QR Code generated. Scan from frontend to connect.');
        } catch (err) {
          console.error('Failed to generate QR data URL', err);
        }
      }
      
      if (connection === 'connecting') {
        connectionStatus = 'connecting';
        qrCode = null;
        console.log('Connecting to WhatsApp...');
      }
      
      if (connection === 'open') {
        connectionStatus = 'connected';
        qrCode = null;
        console.log('WhatsApp connection opened successfully!');
      }
      
      if (connection === 'close') {
        connectionStatus = 'disconnected';
        const lastDisconnectError = lastDisconnect?.error;
        const statusCode = lastDisconnectError?.output?.statusCode;
        
        console.log(`Connection closed. Status code: ${statusCode}`);
        
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('Reconnecting...');
          setTimeout(connectToWhatsApp, 1000);
        } else {
          console.log('Logged out. Clearing session folder and reinitializing...');
          clearSession();
          setTimeout(connectToWhatsApp, 1000);
        }
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
  } catch (error) {
    console.error('Failed to start WhatsApp socket:', error);
    connectionStatus = 'disconnected';
    setTimeout(connectToWhatsApp, 5000);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // support large payloads for base64 images

app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qr: qrCode
  });
});

app.post('/api/send-message', async (req, res) => {
  const { phone, message, image } = req.body;
  
  if (!phone || !message) {
    return res.status(400).json({ error: 'Missing phone or message parameter.' });
  }
  
  if (connectionStatus !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp Gateway is not connected.' });
  }
  
  try {
    // Dukung dua format: nomor HP (08xx -> 628xx) atau JID penuh (mis. grup @g.us)
    const rawPhone = String(phone || '').trim();
    let jid;
    if (rawPhone.includes('@')) {
      // JID penuh — cocok untuk mengirim ke grup WhatsApp (…@g.us)
      jid = rawPhone;
    } else {
      // Format nomor HP Indonesia
      let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      jid = `${cleanPhone}@s.whatsapp.net`;
    }
    
    if (image) {
      // Decode image base64 data url
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      const buffer = Buffer.from(base64Data, 'base64');
      
      console.log(`Sending image message to ${jid}...`);
      await sock.sendMessage(jid, { 
        image: buffer, 
        caption: message 
      });
    } else {
      console.log(`Sending text message to ${jid}...`);
      await sock.sendMessage(jid, { 
        text: message 
      });
    }
    
    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
});

app.get('/api/groups', async (req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp Gateway is not connected.' });
  }

  try {
    const groups = await sock.groupFetchAllParticipating();
    const list = Object.values(groups).map((g) => ({
      id: g.id,
      subject: g.subject,
    }));
    list.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    res.json({ groups: list });
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups: ' + error.message });
  }
});

app.post('/api/logout', async (req, res) => {
  console.log('Logging out from WhatsApp...');
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {
    console.error('Error during Baileys logout:', e);
  }
  
  connectionStatus = 'disconnected';
  qrCode = null;
  clearSession();
  
  res.json({ success: true, message: 'Logged out successfully.' });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`WhatsApp Gateway server listening on port ${PORT}`);
});

connectToWhatsApp();
