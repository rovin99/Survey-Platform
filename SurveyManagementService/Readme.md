# Survey Management Service

The Survey Management Service is a RESTful API built with Go, designed to facilitate the creation, management, and execution of surveys. It supports managing surveys, questions, and conductor roles, integrating with Redis, PostgreSQL, and external authentication and email services.

---

## Features
- **Survey Management**:
  - Create, update, delete, and retrieve surveys.
  - Add, update, and remove survey questions.
- **Conductor Management**:
  - Register, update, and delete conductors.
  - Assign roles to conductors.
  - Email-based verification for conductors.
- **Integration**:
  - Redis for caching.
  - PostgreSQL for data persistence.
  - External authentication and email services.

---

## Architecture
The service uses the following components:
- **Fiber**: Fast HTTP framework for Go.
- **GORM**: ORM for PostgreSQL database interactions.
- **Redis**: In-memory caching.
- **Custom Services**:
  - `AuthService`: Assigns roles to users via an external authentication service.
  - `EmailService`: Sends email notifications for verifications and updates.

---

## Getting Started

### Prerequisites
- Go (version 1.19 or above)
- PostgreSQL
- Redis
- `.env` file with the following environment variables:
  ```env
  DB_HOST=<your_database_host>
  DB_USER=<your_database_user>
  DB_PASSWORD=<your_database_password>
  DB_NAME=<your_database_name>
  DB_PORT=<your_database_port>
  DB_SSLMODE=disable

  REDIS_ADDR=<your_redis_address>
  REDIS_PASSWORD=<your_redis_password>
  REDIS_DB=<your_redis_db_number>

  AUTH_SERVICE_URL=<your_auth_service_base_url>

#### Steps to Run Locally

1. **Clone the Repository**
```bash
git clone <repository-url>
cd SurveyManagementService
```

2. **Configure Environment Variables**
Create a `.env` file in the root directory:
```env
DB_HOST=<your_database_host>
  DB_USER=<your_database_user>
  DB_PASSWORD=<your_database_password>
  DB_NAME=<your_database_name>
  DB_PORT=<your_database_port>
  DB_SSLMODE=disable

  REDIS_ADDR=<your_redis_address>
  REDIS_PASSWORD=<your_redis_password>
  REDIS_DB=<your_redis_db_number>

  AUTH_SERVICE_URL=<your_auth_service_base_url>
```

3. **Install Dependencies**
```bash
go mod tidy

```
4. Run Application
```bash
go run main.go

```
API Routes
Survey Routes
Method	Endpoint	Description
POST	/api/v1/surveys	Create a new survey
GET	/api/v1/surveys	Retrieve all surveys
GET	/api/v1/surveys/:id	Retrieve a survey by ID
PUT	/api/v1/surveys/:id	Update a survey by ID
DELETE	/api/v1/surveys/:id	Delete a survey by ID


Conductor Routes
Method	Endpoint	Description
POST	/api/v1/conductors	Register a new conductor
GET	/api/v1/conductors/:id	Retrieve a conductor by ID
PUT	/api/v1/conductors/:id	Update conductor details
DELETE	/api/v1/conductors/:id	Delete a conductor
GET	/api/v1/conductors	List all conductors
POST	/api/v1/conductors/:id/verify	Verify conductor email
