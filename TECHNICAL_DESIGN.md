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
13. [Local Development Storage System](#13-local-development-storage-system)
14. [Implementation Challenges & Solutions](#14-implementation-challenges--solutions)
15. [Selective File Upload Feature](#15-selective-file-upload-feature)
16. [Libraries & Dependencies Reference](#16-libraries--dependencies-reference)
17. [Security Configuration Summary](#17-security-configuration-summary)
18. [Mobile Offline Features](#18-mobile-offline-features)

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

## 13. Local Development Storage System

### Overview

For local development without AWS S3/Cloudflare R2, BMMS implements a mock local storage system that mimics the behavior of cloud storage presigned URLs. This allows developers to test file upload/download functionality without cloud credentials.

### Storage Mode Configuration

The system automatically detects the storage mode based on environment variables:

```javascript
// config/index.js
const getStorageMode = () => {
  // Explicit mode setting takes priority
  if (process.env.STORAGE_MODE) {
    return process.env.STORAGE_MODE;
  }
  // Auto-detect based on credentials
  const hasS3Credentials = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const hasBucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  if (hasS3Credentials && hasBucket) {
    return 's3';
  }
  return 'local';
};

module.exports = {
  storageMode: getStorageMode(),
  // ... other config
};
```

**Environment Variable:**
```bash
# .env
STORAGE_MODE=local  # 'local' or 's3'
```

### Local Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCAL STORAGE FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Frontend                    API Server                    File     │
│   (React)                    (Express)                    System     │
│                                                                      │
│  1. Request upload URL        │                              │      │
│  ─────────────────────────────>                              │      │
│                               │                              │      │
│  2. Generate token + URL      │                              │      │
│  <─────────────────────────────                              │      │
│  URL: /api/storage/upload/:token                             │      │
│                               │                              │      │
│  3. PUT file to URL           │                              │      │
│  ─────────────────────────────>                              │      │
│                               │  4. Store file              │      │
│                               │  ──────────────────────────>│      │
│                               │                              │      │
│                               │  uploads/meetings/...       │      │
│                               │                              │      │
│  5. Return ETag header        │                              │      │
│  <─────────────────────────────                              │      │
│                               │                              │      │
└─────────────────────────────────────────────────────────────────────┘
```

### Token-Based Presigned URL Emulation

The local storage uses an in-memory Map to store presigned URL tokens:

```javascript
// services/localStorage.js
const presignedUrls = new Map();

const createPresignedToken = (key, contentType, extraData = {}) => {
  const token = uuidv4();
  presignedUrls.set(token, {
    key,
    contentType,
    expiresAt: Date.now() + TOKEN_EXPIRY,
    ...extraData,
  });

  // Auto-cleanup after expiry
  setTimeout(() => {
    presignedUrls.delete(token);
  }, TOKEN_EXPIRY);

  return token;
};
```

**Token Data Structure:**
| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Storage path (e.g., `meetings/{id}/documents/{uuid}.pdf`) |
| `contentType` | string | MIME type of the file |
| `expiresAt` | number | Unix timestamp when token expires |
| `fileName` | string | Original filename (for Content-Disposition) |
| `partNumber` | number | For multipart uploads |
| `uploadId` | string | For multipart uploads |

### File Storage Directory Structure

```
apps/api/
├── uploads/                    # Local file storage root
│   └── meetings/
│       └── {meetingId}/
│           └── documents/
│               ├── {uuid}.pdf
│               ├── {uuid}.docx
│               └── ...
└── src/
    └── services/
        └── localStorage.js     # Local storage service
```

### Storage Routes

```javascript
// routes/storage.routes.js

// File Upload
router.put('/upload/:token', express.raw({ type: '*/*', limit: '60mb' }), async (req, res) => {
  // Validate token
  if (!localStorage.isValidToken(token)) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired upload token');
  }
  // Store file
  const result = await localStorage.storePart(token, req.body);
  // Return ETag like S3
  res.set('ETag', `"${result.etag}"`);
  res.status(200).send();
});

// File Download
router.get('/download/:token', async (req, res) => {
  const forceDownload = req.query.download === 'true';
  const { data, contentType, fileName } = await localStorage.getFileForDownload(token);

  res.set('Content-Type', contentType);
  if (forceDownload && fileName) {
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  } else if (fileName) {
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  }
  res.send(data);
});
```

---

## 14. Implementation Challenges & Solutions

### 14.1 CORS Configuration for File Uploads

**Problem:** Cross-Origin Resource Sharing (CORS) errors when frontend (port 5173/5174) tried to upload files to API (port 3001).

**Error Message:**
```
Access to fetch at 'http://localhost:3001/api/storage/upload/...' has been blocked by CORS policy
```

**Root Cause:**
- Vite dev server runs on different port than API
- File uploads via presigned URLs go directly to API (not through Vite proxy)
- CORS was not configured to allow cross-origin requests

**Solution:**
```javascript
// index.js
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite default port
    'http://localhost:5174',  // Vite alternate port
    'http://localhost:3000',  // Alternative
  ],
  credentials: true,
  exposedHeaders: ['ETag'],  // Expose ETag for upload confirmation
}));
```

**Key Points:**
- `exposedHeaders: ['ETag']` - Required for frontend to read ETag from upload response
- Multiple origins for Vite port variations
- `credentials: true` for authenticated requests

---

### 14.2 Helmet Security Policy for Cross-Origin Resources

**Problem:** File uploads failing due to Helmet's default `Cross-Origin-Resource-Policy`.

**Error Message:**
```
The Cross-Origin-Resource-Policy header has blocked this request
```

**Root Cause:** Helmet's default settings block cross-origin resource sharing.

**Solution:**
```javascript
// index.js
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
```

---

### 14.3 PDF Viewing in iFrame - Content Security Policy

**Problem:** PDF files not displaying in iframe viewer, showing broken image icon.

**Error Message:**
```
Framing 'http://localhost:3001/' violates the following Content Security Policy directive:
"frame-ancestors 'self'". The request has been blocked.
```

**Root Cause:** Helmet's default Content Security Policy (CSP) sets `frame-ancestors 'self'`, which prevents embedding content in iframes from different origins.

**Solution:**
```javascript
// index.js
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: [
        "'self'",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000"
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

**Key Configuration:**
| Directive | Value | Purpose |
|-----------|-------|---------|
| `frameAncestors` | Frontend URLs | Allow embedding in iframes from frontend |
| `crossOriginEmbedderPolicy` | false | Allow loading resources from different origins |
| `crossOriginResourcePolicy` | 'cross-origin' | Allow cross-origin resource sharing |

---

### 14.4 Token Invalidation After First Use

**Problem:** PDF viewer showing blank because token was consumed when fetching preview URL.

**Scenario:**
1. Frontend calls API to get download URL
2. API generates token and returns URL
3. Frontend sets iframe `src` to the URL
4. Browser requests the URL
5. Server deletes token after first use
6. Any subsequent request (iframe retry, download button) fails

**Root Cause:** Token was being deleted in `getFileForDownload()` after first use:
```javascript
// Before - problematic
const getFileForDownload = async (token) => {
  // ... validation ...
  presignedUrls.delete(token);  // Token deleted!
  return { data, contentType };
};
```

**Solution:** Let tokens expire naturally via setTimeout instead of immediate deletion:
```javascript
// After - fixed
const getFileForDownload = async (token) => {
  // ... validation ...
  // Don't delete token - let it expire naturally via setTimeout
  // This allows the URL to be used multiple times (iframe + download)
  return { data, contentType, fileName };
};
```

---

### 14.5 PDF Download vs View Behavior

**Problem:**
- Download button was opening file in browser instead of downloading
- View in iframe was triggering download instead of inline display

**Root Causes:**
1. `link.download` attribute only works for same-origin URLs
2. Server wasn't setting `Content-Disposition` header appropriately
3. All requests treated the same (no distinction between view/download)

**Solution - Backend:**
```javascript
// storage.routes.js
router.get('/download/:token', async (req, res) => {
  const forceDownload = req.query.download === 'true';

  const { data, contentType, fileName } = await localStorage.getFileForDownload(token);

  res.set('Content-Type', contentType);

  // Set Content-Disposition based on intent
  if (forceDownload && fileName) {
    // Force browser to download
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  } else if (fileName) {
    // Allow inline viewing
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  }

  res.send(data);
});
```

**Solution - Frontend:**
```javascript
// For download - add ?download=true
const handleDownload = async (doc) => {
  const { downloadUrl, fileName } = await documentsApi.getDownloadUrl(doc.id);

  // Add download=true query param
  const downloadUrlWithParam = downloadUrl.includes('?')
    ? `${downloadUrl}&download=true`
    : `${downloadUrl}?download=true`;

  const link = document.createElement('a');
  link.href = downloadUrlWithParam;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// For viewing in iframe - no query param (inline)
<iframe src={previewUrl} />
```

**Content-Disposition Header:**
| Value | Behavior |
|-------|----------|
| `inline; filename="file.pdf"` | Display in browser/iframe |
| `attachment; filename="file.pdf"` | Force download dialog |

---

### 14.6 MIME Type Preservation for Downloads

**Problem:** Downloaded PDF files were corrupted because server returned `application/octet-stream` instead of `application/pdf`.

**Root Cause:** Download token didn't store the original MIME type:
```javascript
// Before - hardcoded MIME type
const getDownloadPresignedUrl = async (storageKey) => {
  const token = createPresignedToken(storageKey, 'application/octet-stream');
  // ...
};
```

**Solution:** Pass MIME type through the entire chain:
```javascript
// 1. API endpoint passes MIME type
const downloadUrl = await storage.getDownloadPresignedUrl(
  document.storageKey,
  document.mimeType,    // Pass actual MIME type
  document.fileName     // Pass filename for Content-Disposition
);

// 2. Local storage stores it in token
const getDownloadPresignedUrl = async (storageKey, mimeType, fileName) => {
  const token = createPresignedToken(storageKey, mimeType, { fileName });
  return `${baseUrl}/api/storage/download/${token}`;
};

// 3. Download route uses stored MIME type
const { data, contentType, fileName } = await localStorage.getFileForDownload(token);
res.set('Content-Type', contentType);  // Returns actual MIME type
```

---

### 14.7 Nodemon Restart Clearing In-Memory State

**Problem:** Upload tokens became invalid after code changes because nodemon restarted the server.

**Error Message:**
```
Invalid or expired upload token
```

**Root Cause:**
- Tokens stored in memory (`presignedUrls` Map)
- Code change triggers nodemon restart
- Server restarts with empty Map
- Previously generated tokens become invalid

**Solution (Development):**
- Wait for nodemon to stabilize before uploading
- Don't make code changes during upload process

**Solution (Production):**
- Tokens would be stored in Redis or database
- Server restarts wouldn't affect token validity

---

## 15. Selective File Upload Feature

### Overview

The folder upload feature allows organisers to select specific files from within folders while maintaining the folder hierarchy for the selected files.

### User Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload Documents                                          X    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  3 folders, 5/12 files selected (2.4 MB)                        │
│  [Select all] | [Deselect all] | [Expand] | [Collapse]          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ▼ [✓] 📁 Board Meeting Q4                                │  │
│  │      ▼ [—] 📁 Financial Reports                           │  │
│  │          [✓] 📄 Q4_Budget.xlsx           1.2 MB           │  │
│  │          [✓] 📄 Q4_Expenses.pdf           800 KB          │  │
│  │          [ ] 📄 Draft_Notes.txt            12 KB          │  │
│  │      ▼ [✓] 📁 Presentations                               │  │
│  │          [✓] 📄 Slides.pptx              400 KB           │  │
│  │          [✓] 📄 Handout.pdf              100 KB           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Clear & Reselect]                        [Cancel] [Upload 5]  │
└─────────────────────────────────────────────────────────────────┘
```

### Checkbox States

| Icon | State | Meaning |
|------|-------|---------|
| `[✓]` (CheckSquare) | All selected | All files in folder are selected |
| `[—]` (MinusSquare) | Partial | Some files in folder are selected |
| `[ ]` (Square) | None selected | No files in folder are selected |

### Implementation

**State Management:**
```javascript
const [selectedFiles, setSelectedFiles] = useState(new Set()); // Track selected file paths

// Toggle individual file selection
const toggleFileSelection = (filePath) => {
  setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (next.has(filePath)) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    return next;
  });
};

// Toggle folder selection (all children)
const toggleFolderSelection = (folderPath) => {
  const filePaths = getFilePathsInFolder(folderPath);
  const currentState = getFolderSelectionState(folderPath);

  setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (currentState === 'all') {
      filePaths.forEach((p) => next.delete(p));
    } else {
      filePaths.forEach((p) => next.add(p));
    }
    return next;
  });
};
```

**Upload Logic - Only Selected Files:**
```javascript
const handleUpload = async () => {
  // 1. Collect only selected files
  const filesToUpload = [];
  const collectFiles = (node, parentPath = '') => {
    Object.entries(node.children || {}).forEach(([name, child]) => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      collectFiles(child, path);
    });

    (node.files || []).forEach((fileItem) => {
      if (selectedFiles.has(fileItem.path)) {  // Only selected files
        filesToUpload.push({
          file: fileItem.file,
          path: fileItem.path,
          folderPath: parentPath,
        });
      }
    });
  };
  collectFiles(treeData);

  // 2. Determine which folders are needed
  const foldersNeeded = new Set();
  filesToUpload.forEach(({ folderPath }) => {
    if (folderPath) {
      const parts = folderPath.split('/');
      for (let i = 1; i <= parts.length; i++) {
        foldersNeeded.add(parts.slice(0, i).join('/'));
      }
    }
  });

  // 3. Create only needed folders
  const folders = [];
  const collectFolders = (node, parentPath = '') => {
    Object.entries(node.children || {}).forEach(([name, child]) => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      if (foldersNeeded.has(path)) {  // Only needed folders
        folders.push({ name, path, parentPath: parentPath || null });
        collectFolders(child, path);
      }
    });
  };
  collectFolders(treeData);

  // 4. Upload folders and files...
};
```

---

## 16. Libraries & Dependencies Reference

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.x | Web framework |
| `helmet` | ^7.x | Security headers |
| `cors` | ^2.8.x | Cross-origin resource sharing |
| `morgan` | ^1.10.x | HTTP request logging |
| `bcryptjs` | ^2.4.x | Password hashing |
| `jsonwebtoken` | ^9.x | JWT authentication |
| `@prisma/client` | ^5.x | Database ORM |
| `@aws-sdk/client-s3` | ^3.x | S3 operations |
| `@aws-sdk/s3-request-presigner` | ^3.x | Presigned URL generation |
| `uuid` | ^9.x | UUID generation |
| `express-validator` | ^7.x | Request validation |
| `nodemon` | ^3.x | Development auto-restart |

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.x | UI library |
| `react-dom` | ^18.3.x | React DOM rendering |
| `react-router-dom` | ^6.x | Client-side routing |
| `axios` | ^1.x | HTTP client |
| `lucide-react` | ^0.x | Icon library |
| `react-hot-toast` | ^2.x | Toast notifications |
| `tailwindcss` | ^3.x | Utility CSS framework |
| `date-fns` | ^3.x | Date formatting |
| `vite` | ^5.x | Build tool |

### Icon Usage from Lucide

```javascript
import {
  // File/Folder icons
  Folder, FolderOpen, FileText, FileImage, FileSpreadsheet, File,

  // Action icons
  Upload, Download, Trash2, Eye, ExternalLink,

  // UI icons
  ChevronRight, ChevronDown, X, Check, AlertCircle,
  Loader2, RefreshCw,

  // Selection icons
  Square, CheckSquare, MinusSquare,
} from 'lucide-react';
```

---

## 17. Security Configuration Summary

### Helmet Configuration

```javascript
app.use(helmet({
  // Allow cross-origin resource loading (for file uploads)
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // CSP configuration for iframe embedding
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: [
        "'self'",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000"
      ],
    },
  },

  // Allow embedding resources from different origins
  crossOriginEmbedderPolicy: false,
}));
```

### CORS Configuration

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ],
  credentials: true,
  exposedHeaders: ['ETag'],
}));
```

### File Upload Security

| Security Measure | Implementation |
|-----------------|----------------|
| Token expiration | 1 hour TTL with auto-cleanup |
| Single-use tokens | Tokens can be used until expiry (not single-use) |
| Content-Type validation | Stored and verified with token |
| File size limits | `express.raw({ limit: '60mb' })` |
| Path traversal prevention | UUIDs for file names, controlled directory |

---

## 18. Mobile Offline Features

The mobile app (React Native) is designed exclusively for **external members** who need to view meeting details and documents while potentially being offline. This section documents the offline-first architecture.

### Overview

| Feature | Online Behavior | Offline Behavior |
|---------|----------------|------------------|
| Meeting List | Fetch from API & cache | Show cached data |
| Meeting Details | Fetch from API & cache | Show cached data |
| Documents | Stream from server | Open from local storage |
| Accept/Decline | Enabled | Disabled with message |
| Download for Offline | Available | Not available |

### User Experience Flow

```
1. User opens app (online)
   └── Meetings fetched from API
   └── Meetings cached to AsyncStorage
   └── "Last synced" timestamp saved

2. User views meeting detail (online)
   └── Meeting data fetched from API
   └── Documents list fetched
   └── All data cached locally
   └── User can tap "↓" to save document offline

3. User goes offline
   └── Banner shows "Offline Mode - View Only"
   └── Cached meetings displayed with "Last synced" time
   └── Accept/Decline buttons disabled (grayed out)
   └── Documents marked with "!" if not saved offline
   └── Documents marked with "✓" can be opened

4. User comes back online
   └── Data automatically refreshes
   └── Full functionality restored
```

### Architecture Components

#### 1. Network Status Detection

```javascript
// apps/mobile/src/hooks/useNetworkStatus.js
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
    });
    return () => unsubscribe();
  }, []);

  return { isConnected, connectionType };
}
```

#### 2. Offline Storage Service

The `offlineStorage.js` service handles two types of offline data:

**Document Storage (react-native-fs)**
```javascript
// File storage location
const OFFLINE_DOCS_DIR = `${RNFS.DocumentDirectoryPath}/offline_documents`;

// Download document to local storage
export const downloadDocument = async (document, downloadUrl, onProgress) => {
  const localPath = `${OFFLINE_DOCS_DIR}/${document.id}.${ext}`;

  const result = await RNFS.downloadFile({
    fromUrl: downloadUrl,
    toFile: localPath,
    progress: (res) => {
      onProgress((res.bytesWritten / res.contentLength) * 100);
    },
  }).promise;

  // Save metadata with local path
  await saveDocumentMetadata({ ...document, localPath, isOffline: true });
};
```

**Meeting Cache (AsyncStorage)**
```javascript
// Cache meetings list
export const saveMeetingsOffline = async (meetings) => {
  await AsyncStorage.setItem('offline_meetings', JSON.stringify({
    meetings,
    cachedAt: new Date().toISOString(),
  }));
};

// Cache individual meeting detail
export const saveMeetingDetailOffline = async (meetingId, meeting, folders, documents) => {
  await AsyncStorage.setItem(`offline_meeting_${meetingId}`, JSON.stringify({
    meeting,
    folders,
    documents,
    cachedAt: new Date().toISOString(),
  }));
};
```

#### 3. Storage Keys Reference

| Key | Purpose | Data Structure |
|-----|---------|----------------|
| `offline_documents` | Document metadata | `[{ id, fileName, fileSize, localPath, savedAt }]` |
| `offline_meetings` | Meetings list | `{ meetings: [], cachedAt }` |
| `offline_meeting_{id}` | Single meeting | `{ meeting, folders, documents, cachedAt }` |

### UI Components for Offline Mode

#### Offline Banner (HomeScreen, MeetingDetailScreen)

```jsx
{!isConnected && (
  <View style={styles.offlineBanner}>
    <Text>Offline Mode - View Only</Text>
    <Text>Last synced: {format(cachedAt, 'PPp')}</Text>
  </View>
)}
```

#### Disabled Response Buttons

```jsx
<TouchableOpacity
  style={[
    styles.acceptButton,
    !isConnected && styles.buttonDisabled, // Gray background
  ]}
  disabled={!isConnected}
>
  <Text>{isConnected ? 'Accept' : 'Accept (Offline)'}</Text>
</TouchableOpacity>
```

#### Document Status Indicators

| Icon | Meaning |
|------|---------|
| ↓ (Blue) | Available for download (online only) |
| ✓ (Green) | Saved offline, can be opened |
| ! (Yellow) | Not saved, unavailable offline |
| Spinner | Currently downloading |

### Document Viewing

```javascript
// Open offline document
import FileViewer from 'react-native-file-viewer';

const handleViewDocument = async (doc) => {
  if (isOffline) {
    const localPath = await offlineStorage.getOfflineDocumentPath(doc.id);
    await FileViewer.open(localPath, {
      showOpenWithDialog: true,
      displayName: doc.fileName,
    });
  } else if (isConnected) {
    // Stream from server via Linking
    await Linking.openURL(downloadUrl);
  } else {
    Alert.alert('Not Available Offline', 'Save this document while online');
  }
};
```

### Required Dependencies

```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@react-native-community/netinfo": "^11.4.1",
    "react-native-fs": "^2.20.0",
    "react-native-file-viewer": "^2.1.5"
  }
}
```

### Installation Notes for Native Modules

**iOS (requires CocoaPods)**
```bash
cd apps/mobile/ios && pod install
```

**Android**
- `react-native-fs` and `react-native-file-viewer` auto-link in React Native 0.60+
- May need `android:requestLegacyExternalStorage="true"` in AndroidManifest.xml for older Android versions

### Data Synchronization Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    APP LOAD                              │
├─────────────────────────────────────────────────────────┤
│  isConnected?                                           │
│     YES → fetchFromAPI() → cacheLocally()               │
│     NO  → loadFromCache()                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              NETWORK STATUS CHANGE                       │
├─────────────────────────────────────────────────────────┤
│  Online → Offline:                                      │
│     • Show offline banner                               │
│     • Disable accept/decline buttons                    │
│     • Show "!" for non-cached documents                 │
│                                                         │
│  Offline → Online:                                      │
│     • Refresh data from API                             │
│     • Update local cache                                │
│     • Enable all features                               │
└─────────────────────────────────────────────────────────┘
```

### Download Progress UI

```jsx
// In DocumentTree component
{isDownloading && (
  <View style={styles.progressContainer}>
    <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
  </View>
)}
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| API fetch fails while online | Load from cache as fallback |
| Document not cached when offline | Alert user to save while online |
| File viewer fails | Show "Cannot open file type" message |
| Storage full | Alert user, suggest clearing old files |

### Offline Docs Screen Features

The dedicated "Offline Docs" tab shows:
- Total documents saved
- Storage used (calculated from actual file sizes)
- List of all offline documents with:
  - File type icon (color-coded)
  - File name
  - File size
  - Date saved
- "Clear All" option to free storage
- Tap to open with FileViewer

---

*Document Version: 2.1*
*Last Updated: December 2024*
