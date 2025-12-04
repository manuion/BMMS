# BMMS - Technical Design Document

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Database Design](#database-design)
5. [API Design](#api-design)
6. [Authentication & Authorization](#authentication--authorization)
7. [File Storage & Document Management](#file-storage--document-management)
8. [Real-time Features](#real-time-features)
9. [Mobile Application](#mobile-application)
10. [Web Application](#web-application)
11. [Security Considerations](#security-considerations)
12. [Deployment Architecture](#deployment-architecture)

---

## 1. System Overview

BMMS (Board Meeting Management System) is a comprehensive enterprise application designed to streamline board meeting management for organizations. The system enables administrators to manage committees and users, organizers to schedule meetings and upload documents, and members to view meeting details, respond to invitations, and access documents.

### Key Features
- **Multi-tenant Role-based Access Control**: Admin, Organiser, Member roles with committee-level permissions
- **Document Management**: Hierarchical folder structure with unlimited nesting
- **Presigned URL Uploads**: Direct-to-cloud uploads with chunked upload support for large files
- **Offline-first Mobile App**: Document caching for offline access
- **Push Notifications**: Real-time meeting notifications via Firebase Cloud Messaging

### User Personas
| Role | Platform | Capabilities |
|------|----------|--------------|
| Admin | Web Only | Create users, committees, assign organisers/members |
| Organiser | Web Only | Schedule meetings, upload documents, manage attendees |
| Member (Internal) | Web Only | View meetings, respond, download documents |
| Member (External) | Mobile Only | View meetings, respond, download documents offline |

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
├─────────────────────┬─────────────────────┬─────────────────────────┤
│     Web App         │    Mobile App       │    Admin Dashboard      │
│   (React + Vite)    │  (React Native)     │      (React)            │
└─────────┬───────────┴─────────┬───────────┴───────────┬─────────────┘
          │                     │                       │
          └─────────────────────┼───────────────────────┘
                                │ HTTPS/REST
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                                  │
│                    (Node.js + Express)                              │
├─────────────────────────────────────────────────────────────────────┤
│  Authentication  │  Rate Limiting  │  Request Validation  │  CORS   │
└─────────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│   PostgreSQL    │  │   AWS S3        │  │  Firebase Cloud         │
│   (Database)    │  │   (Storage)     │  │  Messaging (FCM)        │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
```

### Monorepo Structure

```
BMMS/
├── apps/
│   ├── api/                 # Node.js Express API
│   │   ├── prisma/          # Database schema & migrations
│   │   ├── src/
│   │   │   ├── config/      # Environment configuration
│   │   │   ├── middleware/  # Auth, error handling
│   │   │   ├── routes/      # API route handlers
│   │   │   └── services/    # Business logic (storage, notifications)
│   │   └── package.json
│   │
│   ├── web/                 # React Web Application
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── context/     # React Context (Auth)
│   │   │   ├── pages/       # Route pages (admin, organiser, member)
│   │   │   ├── services/    # API client
│   │   │   └── utils/       # Helper functions
│   │   └── package.json
│   │
│   └── mobile/              # React Native Application
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── context/     # Auth context
│       │   ├── navigation/  # React Navigation setup
│       │   ├── screens/     # Screen components
│       │   └── services/    # API, offline storage, push notifications
│       ├── ios/             # iOS native code
│       ├── android/         # Android native code
│       └── package.json
│
├── packages/
│   └── shared/              # Shared utilities & constants
│       ├── constants/
│       └── utils/
│
├── pnpm-workspace.yaml      # Workspace configuration
└── package.json             # Root package.json with scripts
```

### Design Patterns Used

1. **Repository Pattern**: Prisma ORM abstracts database operations
2. **Middleware Pattern**: Express middleware chain for auth, validation, error handling
3. **Context Pattern**: React Context API for global state (authentication)
4. **Container/Presentational Pattern**: Separation of logic and UI in React components
5. **Service Layer Pattern**: Business logic encapsulated in service modules

---

## 3. Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.x | Web framework |
| Prisma | 5.x | ORM for database access |
| PostgreSQL | 15+ | Primary database |
| JWT | - | Authentication tokens |
| bcrypt | - | Password hashing |
| AWS SDK v3 | 3.x | S3 operations |

### Frontend (Web)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI library |
| Vite | 5.x | Build tool & dev server |
| React Router | 6.x | Client-side routing |
| Tailwind CSS | 3.x | Utility-first CSS |
| Axios | 1.x | HTTP client |
| Lucide React | - | Icon library |
| React Hot Toast | - | Toast notifications |

### Mobile
| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.73+ | Cross-platform mobile |
| React Navigation | 6.x | Navigation library |
| Firebase | - | Push notifications |
| AsyncStorage | - | Local data persistence |
| RNFS | - | File system access |
| NetInfo | - | Network status detection |

### Infrastructure
| Service | Purpose |
|---------|---------|
| AWS S3 | Document storage |
| Firebase Cloud Messaging | Push notifications |
| Docker | Containerization |
| PostgreSQL | Relational database |

---

## 4. Database Design

### Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    User     │       │ CommitteeMember  │       │  Committee  │
├─────────────┤       ├──────────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)          │    ┌──│ id (PK)     │
│ email       │  │    │ userId (FK)      │────┘  │ name        │
│ password    │  └────│ committeeId (FK) │       │ description │
│ name        │       │ role             │       │ isActive    │
│ phone       │       │ createdAt        │       │ createdAt   │
│ isAdmin     │       └──────────────────┘       └──────┬──────┘
│ isActive    │                                         │
│ createdAt   │                                         │
└──────┬──────┘                                         │
       │                                                │
       │         ┌─────────────────┐                    │
       │         │    Meeting      │                    │
       │         ├─────────────────┤                    │
       │         │ id (PK)         │────────────────────┘
       │         │ committeeId(FK) │
       │         │ title           │
       │         │ description     │
       │         │ dateTime        │
       │         │ location        │
       │         │ status          │
       │         │ createdById(FK) │──────┐
       │         └────────┬────────┘      │
       │                  │               │
       │    ┌─────────────┴─────────────┐ │
       │    │                           │ │
       │    ▼                           ▼ │
┌──────┴────────┐              ┌──────────┴───────┐
│MeetingResponse│              │    Document      │
├───────────────┤              ├──────────────────┤
│ id (PK)       │              │ id (PK)          │
│ meetingId(FK) │              │ meetingId (FK)   │
│ userId (FK)   │              │ name             │
│ response      │              │ originalName     │
│ respondedAt   │              │ mimeType         │
│               │              │ size             │
└───────────────┘              │ s3Key            │
                               │ path             │
                               │ isFolder         │
                               │ parentId (FK)    │←──┐ Self-reference
                               │ uploadedById(FK) │   │ for nested
                               │ createdAt        │───┘ folders
                               └──────────────────┘
```

### Schema Definition (Prisma)

```prisma
model User {
  id                  String              @id @default(uuid())
  email               String              @unique
  password            String
  name                String
  phone               String?
  isAdmin             Boolean             @default(false)
  isActive            Boolean             @default(true)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  committeeMemberships CommitteeMember[]
  createdMeetings      Meeting[]          @relation("CreatedMeetings")
  meetingResponses     MeetingResponse[]
  uploadedDocuments    Document[]
  deviceTokens         DeviceToken[]
}

model Committee {
  id          String            @id @default(uuid())
  name        String
  description String?
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  members     CommitteeMember[]
  meetings    Meeting[]
}

model CommitteeMember {
  id          String    @id @default(uuid())
  userId      String
  committeeId String
  role        String    @default("member") // "member" | "organiser"
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])
  committee   Committee @relation(fields: [committeeId], references: [id])

  @@unique([userId, committeeId])
}

model Document {
  id            String     @id @default(uuid())
  meetingId     String
  name          String
  originalName  String?
  mimeType      String?
  size          Int?
  s3Key         String?
  path          String     @default("/")
  isFolder      Boolean    @default(false)
  parentId      String?
  uploadedById  String
  createdAt     DateTime   @default(now())

  meeting       Meeting    @relation(fields: [meetingId], references: [id])
  uploadedBy    User       @relation(fields: [uploadedById], references: [id])
  parent        Document?  @relation("FolderHierarchy", fields: [parentId], references: [id])
  children      Document[] @relation("FolderHierarchy")
}
```

### Key Database Design Decisions

1. **UUID Primary Keys**: Using UUIDs instead of auto-increment for better distributed system support and security (non-guessable IDs)

2. **Soft Delete Pattern**: Using `isActive` boolean instead of hard deletes for users and committees to maintain referential integrity and audit trail

3. **Self-Referencing for Folders**: Document table uses `parentId` self-reference to support unlimited folder nesting without additional tables

4. **Path Column for Hierarchy**: Storing full path (e.g., `/folder1/subfolder/`) enables efficient querying of document location without recursive joins

5. **Composite Unique Constraints**: `@@unique([userId, committeeId])` prevents duplicate committee memberships

---

## 5. API Design

### RESTful Endpoint Structure

```
Base URL: /api

Authentication:
  POST   /auth/login          # User login
  GET    /auth/me             # Get current user profile

Users (Admin only):
  GET    /users               # List all users
  POST   /users               # Create user
  GET    /users/:id           # Get user details
  PUT    /users/:id           # Update user
  DELETE /users/:id           # Deactivate user

Committees:
  GET    /committees          # List committees
  POST   /committees          # Create committee (Admin)
  GET    /committees/:id      # Get committee details
  PUT    /committees/:id      # Update committee (Admin)
  DELETE /committees/:id      # Deactivate committee (Admin)
  POST   /committees/:id/members     # Add member
  DELETE /committees/:id/members/:userId  # Remove member

Meetings:
  GET    /meetings            # List meetings (filtered by role)
  POST   /meetings            # Create meeting (Organiser)
  GET    /meetings/:id        # Get meeting details
  PUT    /meetings/:id        # Update meeting (Organiser)
  DELETE /meetings/:id        # Cancel meeting (Organiser)
  POST   /meetings/:id/respond       # Submit attendance response
  GET    /meetings/:id/responses     # Get all responses

Documents:
  GET    /documents/meeting/:meetingId        # List documents
  GET    /documents/meeting/:meetingId/tree   # Get folder tree
  POST   /documents/upload-url                # Get presigned upload URL
  POST   /documents/confirm                   # Confirm upload complete
  GET    /documents/:id/download-url          # Get presigned download URL
  DELETE /documents/:id                       # Delete document

  # Folder operations
  POST   /documents/folders                   # Create folder
  PUT    /documents/folders/:id               # Rename folder
  DELETE /documents/folders/:id               # Delete folder + contents
  PUT    /documents/folders/:id/move          # Move folder
  PUT    /documents/:id/move                  # Move document

Notifications:
  POST   /notifications/register-device       # Register FCM token
  DELETE /notifications/unregister-device     # Remove FCM token
```

### Request/Response Examples

#### Authentication
```javascript
// POST /api/auth/login
Request:
{
  "email": "admin@bmms.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@bmms.com",
      "name": "Admin User",
      "isAdmin": true,
      "committeeMemberships": [...]
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Presigned Upload URL
```javascript
// POST /api/documents/upload-url
Request:
{
  "meetingId": "meeting-uuid",
  "fileName": "quarterly-report.pdf",
  "contentType": "application/pdf",
  "folderId": "folder-uuid"  // optional
}

Response:
{
  "success": true,
  "data": {
    "uploadUrl": "https://bucket.s3.amazonaws.com/...",
    "key": "meetings/meeting-uuid/abc123-quarterly-report.pdf",
    "fields": { ... }  // For multipart uploads
  }
}
```

### Error Handling

All API errors follow a consistent format:

```javascript
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": { ... }  // Optional additional info
}
```

Standard Error Codes:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| CONFLICT | 409 | Resource already exists |
| INTERNAL_ERROR | 500 | Server error |

---

## 6. Authentication & Authorization

### JWT Token Strategy

```javascript
// Token payload structure
{
  "userId": "uuid",
  "iat": 1234567890,      // Issued at
  "exp": 1234571490       // Expiry (7 days)
}
```

### Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌──────────┐
│ Client  │                    │   API   │                    │ Database │
└────┬────┘                    └────┬────┘                    └────┬─────┘
     │                              │                              │
     │  POST /auth/login            │                              │
     │  {email, password}           │                              │
     │─────────────────────────────>│                              │
     │                              │  Find user by email          │
     │                              │─────────────────────────────>│
     │                              │<─────────────────────────────│
     │                              │                              │
     │                              │  Verify password (bcrypt)    │
     │                              │──────────┐                   │
     │                              │<─────────┘                   │
     │                              │                              │
     │                              │  Generate JWT                │
     │                              │──────────┐                   │
     │                              │<─────────┘                   │
     │                              │                              │
     │  {user, token}               │                              │
     │<─────────────────────────────│                              │
     │                              │                              │
     │  Subsequent requests         │                              │
     │  Authorization: Bearer <jwt> │                              │
     │─────────────────────────────>│                              │
     │                              │  Verify JWT                  │
     │                              │──────────┐                   │
     │                              │<─────────┘                   │
```

### Authorization Middleware

```javascript
// Role-based access control middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }
  next();
};

const requireOrganiser = async (req, res, next) => {
  const { meetingId, committeeId } = req.params;

  // Check if user is organiser in the relevant committee
  const membership = await prisma.committeeMember.findFirst({
    where: {
      userId: req.user.id,
      committeeId: committeeId,
      role: 'organiser'
    }
  });

  if (!membership && !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Organiser access required'
    });
  }
  next();
};
```

### Permission Matrix

| Resource | Admin | Organiser | Member |
|----------|-------|-----------|--------|
| Create User | ✓ | ✗ | ✗ |
| Create Committee | ✓ | ✗ | ✗ |
| Add Committee Members | ✓ | ✗ | ✗ |
| Create Meeting | ✓ | ✓ (own committees) | ✗ |
| Upload Documents | ✓ | ✓ (own meetings) | ✗ |
| View Meeting | ✓ | ✓ | ✓ (if member) |
| Download Documents | ✓ | ✓ | ✓ (if member) |
| Respond to Meeting | ✗ | ✓ | ✓ |

---

## 7. File Storage & Document Management

### AWS S3 Integration

#### S3 Bucket Structure
```
bmms-documents/
├── meetings/
│   ├── {meetingId}/
│   │   ├── {uuid}-filename.pdf
│   │   ├── {uuid}-document.docx
│   │   └── ...
```

#### Presigned URL Generation

```javascript
// Generate presigned upload URL
const generateUploadUrl = async (key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType
  });

  return await getSignedUrl(s3Client, command, {
    expiresIn: 3600 // 1 hour
  });
};

// Generate presigned download URL
const generateDownloadUrl = async (key, filename) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`
  });

  return await getSignedUrl(s3Client, command, {
    expiresIn: 3600
  });
};
```

### Chunked Upload for Large Files

For files larger than 5MB, the system uses multipart upload:

```javascript
// Frontend chunked upload implementation
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

const uploadLargeFile = async (file, meetingId) => {
  // 1. Initiate multipart upload
  const { uploadId, key } = await api.initiateMultipartUpload({
    meetingId,
    fileName: file.name,
    contentType: file.type
  });

  // 2. Upload chunks in parallel
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadPromises = [];

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    // Get presigned URL for this part
    const { url } = await api.getPartUploadUrl({
      uploadId,
      key,
      partNumber: i + 1
    });

    uploadPromises.push(
      uploadChunk(url, chunk, i + 1)
    );
  }

  const parts = await Promise.all(uploadPromises);

  // 3. Complete multipart upload
  await api.completeMultipartUpload({
    uploadId,
    key,
    parts
  });
};
```

### Hierarchical Folder Structure

The document system supports unlimited folder nesting using a self-referential design:

```javascript
// Create nested folder structure
const createFolder = async (meetingId, name, parentId = null) => {
  // Get parent path
  let path = '/';
  if (parentId) {
    const parent = await prisma.document.findUnique({
      where: { id: parentId }
    });
    path = `${parent.path}${parent.name}/`;
  }

  return await prisma.document.create({
    data: {
      meetingId,
      name,
      path,
      isFolder: true,
      parentId,
      uploadedById: userId
    }
  });
};

// Get folder tree structure
const getFolderTree = async (meetingId) => {
  const documents = await prisma.document.findMany({
    where: { meetingId },
    orderBy: [
      { isFolder: 'desc' },  // Folders first
      { name: 'asc' }
    ]
  });

  // Build tree from flat list
  return buildTree(documents);
};

const buildTree = (items, parentId = null) => {
  return items
    .filter(item => item.parentId === parentId)
    .map(item => ({
      ...item,
      children: item.isFolder ? buildTree(items, item.id) : undefined
    }));
};
```

---

## 8. Real-time Features

### Push Notifications (Firebase Cloud Messaging)

#### Device Token Registration

```javascript
// Mobile app registers device token on login
const registerDeviceToken = async (token, platform) => {
  await api.post('/notifications/register-device', {
    token,
    platform // 'ios' | 'android'
  });
};
```

#### Server-side Notification Dispatch

```javascript
import admin from 'firebase-admin';

const sendPushNotification = async (userId, notification) => {
  // Get user's device tokens
  const tokens = await prisma.deviceToken.findMany({
    where: { userId }
  });

  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: {
      type: notification.type,
      meetingId: notification.meetingId
    },
    tokens: tokens.map(t => t.token)
  };

  try {
    const response = await admin.messaging().sendMulticast(message);

    // Handle failed tokens (remove invalid ones)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx].token);
        }
      });

      await prisma.deviceToken.deleteMany({
        where: { token: { in: failedTokens } }
      });
    }
  } catch (error) {
    console.error('Push notification failed:', error);
  }
};
```

#### Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| MEETING_CREATED | New meeting scheduled | All committee members |
| MEETING_UPDATED | Meeting details changed | All invited members |
| MEETING_REMINDER | 24h before meeting | Members who responded 'attending' |
| DOCUMENT_ADDED | New document uploaded | All committee members |

---

## 9. Mobile Application

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
├─────────────────────────────────────────────────────────────┤
│  Screens                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   Login     │ │    Home     │ │    Meeting Detail       ││
│  │   Screen    │ │   Screen    │ │    Screen               ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Navigation (React Navigation)                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Auth Stack → Main Stack (Tab Navigator)                 ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Context Providers                                           │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │    Auth     │ │   Network   │                            │
│  │   Context   │ │   Context   │                            │
│  └─────────────┘ └─────────────┘                            │
├─────────────────────────────────────────────────────────────┤
│  Services                                                    │
│  ┌───────────┐ ┌─────────────┐ ┌───────────────────────────┐│
│  │    API    │ │   Offline   │ │   Push Notifications      ││
│  │  Service  │ │   Storage   │ │   Service                 ││
│  └───────────┘ └─────────────┘ └───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Offline Storage Strategy

```javascript
// Offline document caching
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_DIR = `${RNFS.DocumentDirectoryPath}/offline_docs`;

export const downloadForOffline = async (document) => {
  // Download file
  const localPath = `${OFFLINE_DIR}/${document.id}_${document.name}`;

  await RNFS.downloadFile({
    fromUrl: document.downloadUrl,
    toFile: localPath
  }).promise;

  // Save metadata
  const offlineDocs = JSON.parse(
    await AsyncStorage.getItem('offline_documents') || '[]'
  );

  offlineDocs.push({
    ...document,
    localPath,
    downloadedAt: new Date().toISOString()
  });

  await AsyncStorage.setItem(
    'offline_documents',
    JSON.stringify(offlineDocs)
  );
};

export const getOfflineDocuments = async () => {
  return JSON.parse(
    await AsyncStorage.getItem('offline_documents') || '[]'
  );
};
```

### Network Status Handling

```javascript
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return isConnected;
};

// Usage in components
const MeetingsList = () => {
  const isConnected = useNetworkStatus();
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    if (isConnected) {
      // Fetch from API
      fetchMeetingsFromAPI();
    } else {
      // Load cached data
      loadCachedMeetings();
    }
  }, [isConnected]);
};
```

---

## 10. Web Application

### Component Architecture

```
src/
├── components/
│   ├── common/               # Shared components
│   │   ├── Modal.jsx         # Reusable modal dialog
│   │   ├── LoadingSpinner.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── DocumentPreview.jsx
│   │
│   ├── documents/            # Document-related components
│   │   ├── DocumentTree.jsx  # Tree view of folders/files
│   │   └── FolderTreeUpload.jsx  # Upload with folder support
│   │
│   └── layout/
│       ├── Layout.jsx        # Main app layout
│       └── Sidebar.jsx       # Navigation sidebar
│
├── pages/
│   ├── admin/
│   │   ├── Dashboard.jsx
│   │   ├── Committees.jsx
│   │   ├── CommitteeDetail.jsx
│   │   └── Users.jsx
│   │
│   ├── organiser/
│   │   ├── Dashboard.jsx
│   │   ├── Meetings.jsx
│   │   ├── CreateMeeting.jsx
│   │   ├── EditMeeting.jsx
│   │   └── MeetingDetail.jsx
│   │
│   └── member/
│       ├── Dashboard.jsx
│       ├── Meetings.jsx
│       └── MeetingDetail.jsx
│
├── context/
│   └── AuthContext.jsx       # Authentication state
│
└── services/
    └── api.js                # Axios API client
```

### State Management

Using React Context API for global authentication state:

```javascript
// AuthContext.jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verify token validity
      authApi.getMe()
        .then(res => setUser(res.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user, token } = res.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Role checking helpers
  const isOrganiserInAnyCommittee = () => {
    return user?.committeeMemberships?.some(m => m.role === 'organiser');
  };

  const isMemberInAnyCommittee = () => {
    return user?.committeeMemberships?.some(m => m.role === 'member');
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin: user?.isAdmin || false,
      isOrganiserInAnyCommittee,
      isMemberInAnyCommittee
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Protected Routes

```javascript
// ProtectedRoute.jsx
export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireOrganiser = false,
  requireMember = false,
}) {
  const { user, loading, isAdmin, isOrganiserInAnyCommittee, isMemberInAnyCommittee } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={isOrganiserInAnyCommittee() ? '/organiser' : '/member'} replace />;
  }

  if (requireOrganiser && !isAdmin && !isOrganiserInAnyCommittee()) {
    return <Navigate to="/member" replace />;
  }

  if (requireMember && !isAdmin && !isMemberInAnyCommittee()) {
    return <Navigate to="/organiser" replace />;
  }

  return children;
}
```

### Styling with Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          // ... full color scale
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    }
  },
  plugins: []
};
```

---

## 11. Security Considerations

### Authentication Security

1. **Password Hashing**: Using bcrypt with salt rounds of 10
   ```javascript
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **JWT Security**:
   - Tokens expire after 7 days
   - Signed with HS256 algorithm
   - Secret key stored in environment variables

3. **Token Storage**:
   - Web: localStorage (with XSS mitigation via CSP)
   - Mobile: Secure storage (Keychain/Keystore)

### API Security

1. **CORS Configuration**:
   ```javascript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(','),
     credentials: true
   }));
   ```

2. **Rate Limiting**: Implemented at API gateway level

3. **Input Validation**: All inputs validated before processing

4. **SQL Injection Prevention**: Prisma ORM with parameterized queries

### File Upload Security

1. **Content Type Validation**: Only allowed MIME types accepted
2. **File Size Limits**: Enforced at upload URL generation
3. **Presigned URLs**: Time-limited (1 hour), single-use
4. **S3 Bucket Policy**: No public access, only via presigned URLs

### Data Protection

1. **Sensitive Data**: Passwords never returned in API responses
2. **Audit Trail**: `createdAt`, `updatedAt` timestamps on all records
3. **Soft Deletes**: User data preserved for compliance

---

## 12. Deployment Architecture

### Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./apps/api
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/bmms
      - JWT_SECRET=${JWT_SECRET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    depends_on:
      - db

  web:
    build: ./apps/web
    ports:
      - "80:80"
    depends_on:
      - api

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=bmms

volumes:
  postgres_data:
```

### Environment Variables

```bash
# API Environment (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/bmms
JWT_SECRET=your-super-secret-key
PORT=3001

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=bmms-documents

# Firebase
FIREBASE_PROJECT_ID=bmms-project
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

### CI/CD Pipeline (Suggested)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          # Deploy commands here

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm --filter web build
      - name: Deploy to CDN
        run: |
          # Upload to S3/CloudFront
```

---

## Appendix

### A. API Client Configuration

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
```

### B. Prisma Commands Reference

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database
npx prisma migrate reset

# Seed database
npx prisma db seed

# Open Prisma Studio
npx prisma studio
```

### C. Common pnpm Commands

```bash
# Install all dependencies
pnpm install

# Run specific app
pnpm --filter api dev
pnpm --filter web dev

# Run all apps
pnpm dev

# Build for production
pnpm build

# Add dependency to specific app
pnpm --filter api add express
pnpm --filter web add react-router-dom
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
