import type { Express } from "express";
import { createServer, type Server } from "http";
import { createWebRouter } from './web/routes.js';
import { createPhoneRouter } from './phone/routes.js';
import { createFunctionCallingRouter } from './phone/functions/function-calling/routes.js';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  app.use(createWebRouter());

  app.use(createPhoneRouter(httpServer));

  app.use(createFunctionCallingRouter());

  return httpServer;
}