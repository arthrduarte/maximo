import type { Router } from "express";
import express from 'express';
import adminRoutes from './routes/admin.routes.js';

export function createWebRouter(): Router {
  const router = express.Router();

  // Enable JSON parsing for the router
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  // Mount admin API routes
  router.use('/api/admin', adminRoutes);

  // Then handle static files and page routes
  router.use(express.static('public'));

  router.get('/admin/login', (req, res) => {
    res.sendFile('admin/login.html', { root: 'public' });
  });

  router.get('/admin/calendar', (req, res) => {
    res.sendFile('admin/calendar.html', { root: 'public' });
  });
  
  router.get('/admin/users', (req, res) => {
    res.sendFile('admin/users.html', { root: 'public' });
  });

  return router;
} 