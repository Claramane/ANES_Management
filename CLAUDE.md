# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **麻醉科護理班表管理系統** (Anesthesia Nursing Schedule Management System) - a full-stack web application designed for managing nursing schedules in anesthesia departments. The system supports role-based access control, complex scheduling algorithms, shift swapping, overtime tracking, and real-time user status monitoring.

## Common Development Commands

### Frontend (React)
```bash
cd frontend
npm install          # Install dependencies
npm start           # Start development server (port 3000)
npm run build       # Build for production
npm test            # Run tests
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt  # Install dependencies
python main.py      # Start development server (port 8000)
python init_db.py   # Initialize database
```

### Database Operations
```bash
# Backend database operations
python backend/init_db.py                    # Initialize database with tables
python backend/migrations/initial_data.py    # Populate initial data
python backend/scripts/reset_logs.py         # Reset application logs
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 18, Material-UI, Zustand (state management), React Router
- **Backend**: FastAPI, SQLAlchemy, JWT authentication, WebAuthn/Passkey support
- **Database**: PostgreSQL/SQLite with SQLAlchemy ORM
- **Scheduling**: APScheduler for automated tasks
- **Authentication**: JWT + WebAuthn/Passkey biometric authentication

### Key Architectural Patterns

#### 1. Role-Based Access Control
- **Roles**: `head_nurse`, `nurse`, `boss`, `admin`
- **Identity Types**: Different nursing categories with specific shift patterns
  - 麻醉專科護理師: D(日班), A(小夜班), N(大夜班), O(休假)
  - 恢復室護理師: A(日班), K(早班), C(中班), F(晚班), O(休假)
  - 麻醉科Leader: A(日班), E(半班), O(休假)
  - 麻醉科書記: B(日班), E(半班), O(休假)

#### 2. State Management (Zustand)
- **authStore.js**: Authentication, user management, Passkey functionality
- **scheduleStore.js**: Schedule data, formula patterns, shift assignments
- **settingsStore.js**: Application settings, preferences
- **userStore.js**: User management operations

#### 3. Backend Service Layer
- **Models**: SQLAlchemy ORM models in `backend/app/models/`
- **Routes**: FastAPI routers in `backend/app/routes/`
- **Schemas**: Pydantic validation schemas in `backend/app/schemas/`
- **Services**: Business logic in `backend/app/services/`

#### 4. Core Features Architecture

**Schedule Management**:
- Formula-based schedule generation with different patterns per identity type
- Work assignment system for A-shift nurses (OR, DR, 3F areas)
- Night shift package system (SNP/LNP classifications)
- Overtime tracking with automatic scoring

**Doctor Schedule System**:
- External API integration for doctor schedule data
- Automated updates every 5 minutes (current month) and daily (future months)
- Status management (on-duty, off-duty, meeting, leave)
- Area code management for work assignments

**Shift Swapping**:
- Complete workflow: request → approval → notification → history
- Automatic validation for shift conflicts and work hour rules
- Status tracking: pending, accepted, rejected, cancelled, expired

**Authentication**:
- Traditional username/password + JWT
- WebAuthn/Passkey biometric authentication
- Session management with automatic token refresh

## Database Schema Notes

### Key Tables
- `users`: User accounts with roles and identity types
- `schedules`: Monthly schedule assignments
- `formula_schedules`: Schedule templates/patterns
- `shift_swap_requests`: Shift exchange requests
- `overtime_records`: Overtime tracking and scoring
- `doctor_schedules`: Doctor schedule data from external API
- `announcements`: System announcements

### Important Relationships
- Users → Schedules: One-to-many relationship
- Schedules → Work assignments: Embedded JSON for A-shift assignments
- Doctor schedules → Day shift details: Foreign key relationships

## Development Patterns

### Frontend Component Structure
```
src/
├── components/           # Reusable UI components
│   ├── Layout.jsx       # Main application layout
│   ├── common/          # Shared components
│   └── ShiftSwap/       # Feature-specific components
├── pages/               # Route-level components
├── store/               # Zustand state management
├── utils/               # Utility functions
└── hooks/               # Custom React hooks
```

### Backend Module Structure
```
backend/app/
├── core/                # Core configuration and database
├── models/              # SQLAlchemy ORM models
├── routes/              # FastAPI route handlers
├── schemas/             # Pydantic validation schemas
├── services/            # Business logic layer
├── tasks/               # Background tasks (APScheduler)
└── utils/               # Utility functions
```

## Key Configuration

### Environment Variables
- Database connection settings in `backend/app/core/config.py`
- Frontend API proxy configured in `frontend/package.json` (proxy: "http://localhost:8001")
- CORS origins dynamically set based on environment

### Authentication Flow
1. Traditional login: POST `/api/login` with form data
2. JWT token storage in localStorage via Zustand persist
3. Automatic token validation and refresh
4. Passkey registration/authentication via WebAuthn API

### Scheduling System
- Formula patterns define weekly schedules for different identity types
- Monthly schedules generated from formulas with manual adjustments
- Work assignments for A-shift nurses stored as JSON in schedule records
- Overtime automatically calculated based on shift patterns and identity

## Testing

### Database Testing
- Use `backend/init_db.py` to reset database state
- Initial data populated via `backend/migrations/initial_data.py`
- Test accounts: admin/changeme, nurse/password

### Frontend Testing
- React Testing Library configured in `frontend/package.json`
- Run tests with `npm test` in frontend directory

## Security Notes

- JWT tokens with automatic expiration checking
- WebAuthn/Passkey implementation for passwordless authentication
- CORS configured for development and production environments
- SQL injection prevention through SQLAlchemy ORM
- Input validation via Pydantic schemas

## Deployment Configuration

- Frontend build output in `frontend/build/`
- Backend WSGI server configuration in `backend/main.py`
- Database migrations in `backend/migrations/`
- Platform-specific configs: `vercel.json`, `zeabur.json`