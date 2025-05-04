import './config/env.js';
import express, { type Request, Response, NextFunction } from "express";
import session from 'express-session';
import { registerRoutes } from "./routes.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyEmailConfig } from './phone/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable parsing of both JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else {
    // In production, only allow same origin
    // The default behavior will work since we're serving from the same origin
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'maximo-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Register API routes first
const server = registerRoutes(app);

// Then serve static files
app.use(express.static(path.resolve(__dirname, '../public')));

// Specific route for privacy policy
app.get('/privacy', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/privacy/privacy.html'));
});

// Also handle '/privacy/' with trailing slash
app.get('/privacy/', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/privacy/privacy.html'));
});

// Specific route for terms
app.get('/terms', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/terms/terms.html'));
});

// Also handle '/terms/' with trailing slash
app.get('/terms/', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/terms/terms.html'));
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Catch-all route to serve index.html should be last
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

// Use Heroku's PORT or fallback to 5001
const port = parseInt(process.env.PORT || '5001', 10);
server.listen(port, "0.0.0.0", async () => {
  console.log(`Server running on http://localhost:${port}`);
  
  // Verify email configuration
  const emailConfigValid = await verifyEmailConfig();
  if (!emailConfigValid) {
    console.error('❌ Failed to initialize email service - calendar invites will not be sent');
  }
});