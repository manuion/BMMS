# BMMS - Board Meeting Management System

A comprehensive board meeting management application for organizing committee meetings, managing members, uploading agenda documents, and handling meeting responses.

## Architecture

```
bmms/
├── apps/
│   ├── api/          # Node.js + Express Backend
│   ├── web/          # React + Vite (Admin & Organiser)
│   └── mobile/       # React Native CLI (Members)
├── packages/
│   └── shared/       # Shared constants & utilities
└── docker-compose.yml
```

## User Roles & Access

### Platform Access
| User Type | Web | Mobile |
|-----------|-----|--------|
| **Internal (Org Employees)** | ✅ Admin, Organiser, Member dashboards | ❌ No access |
| **External Members** | ❌ No access | ✅ Member dashboard only |

### Roles
| Role | Description |
|------|-------------|
| **Admin** | Creates users, committees, adds users to committees, assigns organiser roles |
| **Organiser** | Manages meetings for assigned committees (schedule, upload documents, view responses) |
| **Member** | Views meetings, accepts/declines invites, views/downloads documents |

### Key Rules
- **Web app** = Internal org employees only (can be Admin, Organiser, or Member)
- **Mobile app** = External members only (Member role only)
- A **User** can be both an **Organiser** (for some committees) AND a **Member** (in other committees)
- Same user sees **Organiser Dashboard** for committees they organise, **Member Dashboard** for committees they're a member of

## Features

### Web App (Admin, Organiser & Internal Members)
- **Admin Module**
  - Create and manage users
  - Create and manage committees
  - Add/remove members to committees
  - Assign organiser roles to users

- **Organiser Module**
  - Schedule, reschedule, and cancel meetings
  - Upload agenda documents (up to 60MB each, 60 docs per meeting)
  - View member responses (accepted/declined/pending)
  - Resumable multipart uploads for large files

- **Member Module (Internal only)**
  - View upcoming meetings
  - Accept or decline meeting invitations
  - View and download agenda documents

### Mobile App (All Members + Organisers)
- View upcoming meetings
- Accept or decline meeting invitations
- View agenda documents
- Download documents for offline viewing
- Offline document access
- **Note:** External members can ONLY access via mobile app

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL |
| Web Frontend | React, Vite, TailwindCSS |
| Mobile Frontend | React Native CLI |
| File Storage | Cloudflare R2 / AWS S3 |
| Auth | JWT |

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local PostgreSQL)
- For mobile: Xcode (iOS) / Android Studio (Android)

## Quick Start

### 1. Install Dependencies

```bash
# Install pnpm if not installed
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Setup API

```bash
# Copy environment file
cp apps/api/.env.example apps/api/.env

# Run database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Seed database with test data
pnpm --filter @bmms/api db:seed
```

### 4. Start Development Servers

```bash
# Terminal 1: Start API
pnpm dev:api

# Terminal 2: Start Web App
pnpm dev:web

# Terminal 3: Start Mobile (iOS)
cd apps/mobile
npx react-native run-ios

# Or for Android
npx react-native run-android
```

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bmms.com | admin123 |
| Organiser | organiser@bmms.com | organiser123 |
| Member | member1@bmms.com | member123 |

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Committees
- `GET /api/committees` - List committees
- `GET /api/committees/organiser` - List committees where user is organiser
- `POST /api/committees` - Create committee (Admin)
- `POST /api/committees/:id/members` - Add member (Admin)

### Meetings
- `GET /api/meetings` - List meetings
- `POST /api/meetings` - Create meeting (Organiser)
- `PUT /api/meetings/:id` - Update meeting (Organiser)
- `DELETE /api/meetings/:id` - Cancel meeting (Organiser)
- `POST /api/meetings/:id/respond` - Accept/Decline (Member)

### Documents
- `POST /api/documents/initiate-upload` - Start upload
- `PUT /api/documents/:id/progress` - Update chunk progress
- `POST /api/documents/:id/complete` - Complete upload
- `POST /api/documents/:id/resume` - Resume failed upload
- `GET /api/documents/:id/download` - Get download URL

## File Upload Flow

For large files (>5MB), the system uses multipart uploads:

```
1. Client: POST /api/documents/initiate-upload
   → Returns: { documentId, presignedUrls[], totalChunks }

2. Client: Upload chunks to presigned URLs
   → PUT to each presignedUrl with file chunk

3. Client: PUT /api/documents/:id/progress
   → Report each chunk completion with ETag

4. Client: POST /api/documents/:id/complete
   → Finalize the upload

On failure: POST /api/documents/:id/resume
   → Returns remaining chunks to upload
```

## Environment Variables

### API (.env)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bmms"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001

# Cloudflare R2
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="bmms-documents"
```

## Deployment

### Backend (Railway/Render)
1. Connect your repository
2. Set environment variables
3. Deploy

### Web (Vercel/Netlify)
1. Connect repository
2. Set build command: `pnpm --filter @bmms/web build`
3. Set output directory: `apps/web/dist`

### Mobile
- iOS: Build with Xcode and submit to App Store
- Android: Build APK/AAB and submit to Play Store

## Project Structure Details

### API Structure
```
apps/api/
├── src/
│   ├── config/         # Configuration
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, error handling
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── utils/          # Helpers
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.js         # Seed data
└── package.json
```

### Web Structure
```
apps/web/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   │   ├── admin/      # Admin pages
│   │   └── organiser/  # Organiser pages
│   ├── services/       # API calls
│   ├── context/        # React context
│   └── hooks/          # Custom hooks
└── package.json
```

### Mobile Structure
```
apps/mobile/
├── src/
│   ├── screens/        # Screen components
│   ├── navigation/     # Navigation setup
│   ├── services/       # API & offline storage
│   ├── context/        # Auth context
│   └── hooks/          # Custom hooks
└── package.json
```

## License

MIT
