import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { config } from './config';
import prisma from './lib/prisma';

// Routes
import { authRoutes } from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import campaignRoutes from './routes/campaigns';
import { leadRoutes } from './routes/leads';
import dashboardRoutes from './routes/dashboard';
import leaderboardRoutes from './routes/leaderboard';
import adminRoutes from './routes/admin';
import teamLeaderRoutes from './routes/teamLeader';
import accountManagerRoutes from './routes/accountManager';
import leaveRequestRoutes from './routes/leaveRequests';
import settingsRoutes from './routes/settings';
import analyticsRoutes from './routes/analytics';
import clientRoutes from './routes/client';
import clientTeamRoutes from './routes/clientTeam';
import { teamMemberRoutes } from './routes/teamMember';
import positionsRoutes from './routes/positions';
import tasksRoutes from './routes/tasks';
import automationRulesRoutes from './routes/automationRules';

import qcRoutes from './routes/qc';
import itTicketsRoutes from './routes/itTickets';
import itAssignmentsRoutes from './routes/itAssignments';
import duplicateCheckRoutes from './routes/duplicateCheck';
import pipelineStagesRoutes from './routes/pipelineStages';
import formTemplatesRoutes from './routes/formTemplates';
import backupRoutes from './routes/backup';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup
export const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(compression());

// Serve uploaded files with proper headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp3') || path.endsWith('.wav') || path.endsWith('.ogg') || path.endsWith('.m4a')) {
      res.set('Accept-Ranges', 'bytes');
      res.set('Content-Type', 'audio/mpeg');
    }
  }
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (after body parsing, before routes)
app.use(requestLogger);

// Health check - Enhanced with database connectivity
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    services: {
      database: 'unknown',
      server: 'healthy'
    }
  };

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'healthy';
  } catch (error) {
    health.status = 'DEGRADED';
    health.services.database = 'unhealthy';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/team-leader', teamLeaderRoutes);
app.use('/api/account-manager', accountManagerRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/client', clientTeamRoutes);
app.use('/api/team-member', teamMemberRoutes);
app.use('/api/client/positions', positionsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/pipeline/automation-rules', automationRulesRoutes);

app.use('/api/qc', qcRoutes);
app.use('/api/duplicate-check', duplicateCheckRoutes);
app.use('/api/it-tickets', itTicketsRoutes);
app.use('/api/admin/it-assignments', itAssignmentsRoutes);
app.use('/api/pipeline-stages', pipelineStagesRoutes);
app.use('/api/form-templates', formTemplatesRoutes);
app.use('/api/backup', backupRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export { app, server };









