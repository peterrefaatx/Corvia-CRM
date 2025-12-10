# Corvia CRM

A comprehensive Customer Relationship Management system built with modern web technologies for sales teams and organizations.

## Features

### Lead Management
- Complete lead lifecycle tracking from acquisition to closure
- Lead scoring and qualification system
- Automated lead distribution and assignment
- Duplicate detection and prevention
- Call recording and activity logging

### Analytics and Reporting
- Real-time performance metrics and KPIs
- Team and individual agent analytics
- Pipeline conversion tracking
- Revenue forecasting and reporting
- Export capabilities (CSV, PDF)

### Role-Based Access Control
- **Admin**: Full system control and user management
- **Manager**: Team oversight and analytics access
- **Team Leader**: Team performance monitoring
- **Account Manager**: Client relationship management
- **Senior Agent/Agent**: Lead processing and sales activities
- **QC Agent**: Quality control and lead verification
- **IT Support**: Technical support ticket management
- **Client**: Dedicated portal for lead tracking

### Pipeline Management
- Customizable sales stages and workflows
- Automated stage progression rules
- Pipeline health monitoring
- Performance optimization tools

### Team Management
- User management with role-based permissions
- Team member scheduling and task assignment
- Leave request management system
- Quality control dashboard

### Client Portal
- Dedicated client interface for lead oversight
- Real-time lead status updates
- Communication tracking
- Performance reporting

## Technology Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Vite for build tooling
- Socket.io client for real-time updates

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- Socket.io for real-time communication
- JWT authentication

### Deployment
- Docker containerization
- Docker Compose orchestration
- Nginx web server

## Getting Started

### Prerequisites
- Node.js v18 or higher
- PostgreSQL 14 or higher
- npm or yarn
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository
```bash
git clone https://github.com/peterrefaatx/Corvia-CRM.git
cd Corvia-CRM
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Environment Configuration

Create `.env` files in both backend and frontend directories:

**Backend `.env`:**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/corvia_crm"
JWT_SECRET="your-jwt-secret-key"
PORT=5000
NODE_ENV=development
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000
```

5. Database Setup
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

6. Start Development Servers

Backend:
```bash
cd backend
npm run dev
```

Frontend (in a new terminal):
```bash
cd frontend
npm run dev
```

Access the application at `http://localhost:5173`

### Docker Deployment

For containerized deployment:

```bash
docker-compose up -d
```

## Project Structure

```
Corvia-CRM/
├── backend/                           # Node.js API Server
│   ├── src/
│   │   ├── routes/                    # API Endpoints
│   │   │   ├── admin.ts               # Admin management routes
│   │   │   ├── analytics.ts           # Analytics and reporting
│   │   │   ├── auth.ts                # Authentication routes
│   │   │   ├── campaigns.ts           # Campaign management
│   │   │   ├── client.ts              # Client portal routes
│   │   │   ├── clientTeam.ts          # Client team management
│   │   │   ├── leads.ts               # Lead management
│   │   │   ├── pipelineStages.ts      # Pipeline configuration
│   │   │   ├── tasks.ts               # Task management
│   │   │   ├── teamMember.ts          # Team member operations
│   │   │   ├── users.ts               # User management
│   │   │   ├── itTickets.ts           # IT support tickets
│   │   │   └── leaveRequests.ts       # Leave management
│   │   ├── middleware/                # Express Middleware
│   │   │   ├── auth.ts                # JWT authentication
│   │   │   ├── requireRole.ts         # Role-based access control
│   │   │   ├── validate.ts            # Request validation
│   │   │   └── upload.ts              # File upload handling
│   │   ├── services/                  # Business Logic Layer
│   │   │   ├── authService.ts         # Authentication logic
│   │   │   ├── backup.service.ts      # Database backup
│   │   │   └── restore.service.ts     # Database restore
│   │   ├── utils/                     # Helper Functions
│   │   │   ├── permissions.ts         # Permission utilities
│   │   │   ├── leadFormatter.ts       # Lead data formatting
│   │   │   ├── stageCompletion.ts     # Pipeline stage logic
│   │   │   └── calculations.ts        # Analytics calculations
│   │   ├── jobs/                      # Background Tasks
│   │   │   ├── databaseBackup.ts      # Automated backups
│   │   │   ├── dailyLoginSnapshot.ts  # Login analytics
│   │   │   └── dataRetentionCleanup.ts # Data cleanup
│   │   └── controllers/               # Route Controllers
│   ├── prisma/                        # Database Layer
│   │   ├── schema.prisma              # Database schema
│   │   └── seed.ts                    # Database seeding
│   ├── scripts/                       # Database Scripts
│   ├── uploads/                       # File Storage
│   │   └── recordings/                # Call recordings
│   ├── backups/                       # Database backups
│   ├── package.json                   # Dependencies
│   └── Dockerfile                     # Container config
├── frontend/                          # React Client Application
│   ├── src/
│   │   ├── components/                # Reusable UI Components
│   │   │   ├── Layout/                # Application layout
│   │   │   ├── LoadingSpinner.tsx     # Loading indicators
│   │   │   ├── LoadingBar.tsx         # Progress bars
│   │   │   └── ProtectedRoute.tsx     # Route protection
│   │   ├── pages/                     # Page Components
│   │   │   ├── AdminDashboard.tsx     # Admin interface
│   │   │   ├── ManagerAnalytics.tsx   # Manager analytics
│   │   │   ├── TeamLeaderReports.tsx  # Team leader reports
│   │   │   ├── AccountManagerAnalytics.tsx # Account manager analytics
│   │   │   ├── LeadsList.tsx          # Lead management
│   │   │   ├── LeadDetail.tsx         # Lead details
│   │   │   ├── ClientDashboard.tsx    # Client portal
│   │   │   ├── ClientPipeline.tsx     # Client pipeline view
│   │   │   ├── ClientTeamMembers.tsx  # Team management
│   │   │   ├── ClientTasks.tsx        # Task management
│   │   │   ├── UserManagement.tsx     # User administration
│   │   │   ├── PipelineStagesManagement.tsx # Pipeline config
│   │   │   ├── ITTicketsList.tsx      # IT support
│   │   │   └── LeaveRequests.tsx      # Leave management
│   │   ├── contexts/                  # React Context Providers
│   │   │   ├── AuthContext.tsx        # Authentication state
│   │   │   ├── SocketContext.tsx      # Real-time updates
│   │   │   └── ToastContext.tsx       # Notifications
│   │   ├── services/                  # API Communication
│   │   │   └── api.ts                 # HTTP client
│   │   ├── utils/                     # Frontend Utilities
│   │   │   └── roleBadgeColors.ts     # UI styling utilities
│   │   ├── config/                    # Configuration
│   │   │   └── routePermissions.ts    # Route access control
│   │   └── hooks/                     # Custom React Hooks
│   ├── public/                        # Static Assets
│   │   └── fonts/                     # Typography assets
│   ├── package.json                   # Dependencies
│   ├── tailwind.config.js             # Styling configuration
│   ├── vite.config.ts                 # Build configuration
│   └── Dockerfile                     # Container config
├── landing-page/                      # Marketing Site
│   └── index.html                     # Landing page
├── scripts/                           # Deployment Scripts
│   ├── check-stages.ts                # Database validation
│   └── reset-pipeline.ts              # Pipeline reset utility
├── docker-compose.yml                 # Multi-container setup
├── .gitignore                         # Git ignore rules
└── README.md                          # Project documentation
```

## Available Scripts

### Backend
```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
```

### Frontend
```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview build
```

## License

This project is proprietary software.