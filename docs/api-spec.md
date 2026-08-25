# API Specification — Shalimar Logistics REST Engine

## 1. Authentication Endpoints

### `POST /api/auth/login`
- **Description**: Authenticate user credentials and return session token.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "your_password"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "user": {
      "id": "usr_admin",
      "username": "admin",
      "name": "Shalimar Admin (Logistics Head)",
      "role": "admin"
    }
  }
  ```

---

## 2. State Management Endpoints

### `GET /api/state`
- **Description**: Fetch complete system state (MySQL database + cache).
- **Security**: Passwords stripped automatically via `sanitizeStateForClient()`.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "company": { ... },
      "rate_requests": [ ... ],
      "rate_submissions": [ ... ],
      "master_records": [ ... ]
    }
  }
  ```

### `POST /api/state`
- **Description**: Save full system state snapshot and synchronize MySQL relational tables.
- **Request Body**: JSON object containing state updates.

---

## 3. Dedicated Resource Endpoints

### `GET /api/products`
- **Description**: Fetch all Product Master directory entries from MySQL `master_records`.

### `POST /api/products`
- **Description**: Insert or update a Product Master entry in MySQL `master_records`.

### `POST /api/bids`
- **Description**: Insert or update a Transporter Rate Bid in MySQL `rate_submissions`.

### `GET /api/health`
- **Description**: Health check endpoint returning server status, timestamp, and active environment details.
