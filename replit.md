# WhatsApp Blast Desktop Manager

## Overview
A modern web-based application for managing multiple WhatsApp sessions and sending bulk messages. Converted from Electron desktop app to a full-stack web application with Express backend and Socket.IO for real-time updates. The app provides a clean dark-themed interface for creating WhatsApp sessions, importing contacts from Excel, and sending both individual and bulk messages.

## Recent Changes
- **October 28, 2025**: Converted from Electron to Web Application
  - Created Express server with REST API endpoints for all features
  - Implemented Socket.IO for real-time session updates
  - Set up multer for secure file uploads (Excel contact import)
  - Converted renderer.js to browser-compatible code using fetch and WebSocket
  - Reorganized project structure with public folder for static assets
  - Updated workflow to run on port 5000 with webview output
  - Maintained all original features: multi-session, QR/pairing codes, contacts, messaging

## Project Architecture

### Tech Stack
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.IO
- **Frontend**: Vanilla JavaScript (browser-compatible)
- **UI Framework**: Bootstrap 5 with custom dark theme
- **WhatsApp Integration**: @whiskeysockets/baileys library
- **Database**: node-json-db (JSON-based local storage)
- **File Upload**: multer (10MB limit, Excel/CSV only)
- **File Processing**: xlsx for Excel import

### Key Components
1. **Express Server** (`server.js`)
   - REST API endpoints for all features
   - Socket.IO server for real-time updates
   - Static file serving from public folder
   - WhatsApp Manager initialization and lifecycle
   - File upload handling with multer

2. **Frontend** (`public/`)
   - `index.html`: Main UI layout with navigation and tabs
   - `assets/renderer.js`: Browser-compatible UI logic with fetch and WebSocket
   - `assets/style.css`: Dark-themed WhatsApp-style UI

3. **WhatsApp Manager** (`services/whatsapp-manager.js`)
   - Manages multiple WhatsApp sessions
   - Handles QR code and pairing code authentication
   - Message sending and session management

4. **API Endpoints**
   - GET `/api/sessions` - List all sessions
   - POST `/api/sessions` - Create new session
   - POST `/api/sessions/:id/logout` - Logout session
   - POST `/api/messages/send` - Send single message
   - POST `/api/messages/blast` - Send bulk messages
   - POST `/api/contacts/import` - Import contacts from Excel
   - GET `/api/manager/status` - Check manager initialization status

### File Structure
```
├── server.js              # Express server with REST API and Socket.IO
├── package.json           # Dependencies and scripts
├── crypto-polyfill.js     # Crypto compatibility layer
├── public/                # Static assets served by Express
│   ├── index.html         # Main UI layout
│   └── assets/
│       ├── renderer.js    # Browser-compatible UI logic
│       ├── style.css      # Dark theme styles
│       └── screenshot/    # UI screenshots
├── services/
│   └── whatsapp-manager.js # WhatsApp session management
├── uploads/               # Temporary file upload directory
├── main.js                # (Legacy) Electron main process
└── preload.js             # (Legacy) Electron IPC bridge
```

## Features
- **Multi-Session Management**: Connect multiple WhatsApp accounts simultaneously
- **QR Code & Pairing Code**: Two methods to authenticate WhatsApp
- **Contact Import**: Import contacts from Excel files (.xlsx, .xls)
- **Bulk Messaging**: Send messages to multiple contacts across multiple sessions
- **Single Message**: Send individual messages to specific contacts
- **Real-time Updates**: Live session status monitoring

## Running the Application

### Development Mode
The app runs via the "WhatsApp Blast App" workflow which executes:
```bash
npm start
```

This launches the Express web server on:
- **Host**: 0.0.0.0 (accessible from Replit webview)
- **Port**: 5000

### Accessing the Application
Access the web UI through Replit's webview panel. The application is fully browser-based with real-time updates via WebSocket.

### Data Storage
All data is stored locally in:
```
/home/runner/workspace/.config/whatsapp-blast-manager/
├── sessions/    # WhatsApp session data
├── database/    # JSON database (db.json)
└── logs/        # Application logs
```

## Environment-Specific Configuration

### Port Configuration
- The server binds to `0.0.0.0:5000` to be accessible through Replit's proxy
- WebSocket connections use the same port for real-time updates

### File Upload Security
- Upload limit: 10MB
- Allowed file types: .xlsx, .xls, .csv
- Temporary files are automatically deleted after processing
- Files are validated and sanitized before parsing

## Development Notes

### Real-time Updates
- Session status changes are broadcast to all connected clients via Socket.IO
- Automatic 5-second polling for session updates
- WebSocket reconnection handling built-in

### API Architecture
- RESTful endpoints for CRUD operations
- WebSocket for push notifications
- JSON request/response format
- Comprehensive error handling with descriptive messages

### Excel Format for Contacts
Expected columns: `Name` (or `name`), `Phone` (or `phone`, `Number`, `phoneNumber`)
Example:
| Name | Phone |
|------|-------|
| John Doe | +1234567890 |

### Security Notes
- All session data is stored locally
- No external data transmission except through WhatsApp's official API
- Context isolation enabled in Electron for security
- Node integration disabled in renderer process

## License
MIT License - See LICENSE file for details

## Original Author
Abdul Muttaqin ([@fdciabdul](https://github.com/fdciabdul))
