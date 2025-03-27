# Survey Management Service API Documentation

This service provides a comprehensive REST API for managing surveys, questions, answers, media, and draft surveys. Below is the detailed documentation of all available endpoints.

## Survey Routes
Base path: `/api/surveys`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/:id/progress` | GET | Retrieve the progress of a specific survey |
| `/:id` | GET | Get details of a specific survey |

## Draft Management Routes
Base path: `/api/v1`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/drafts` | POST | Create a new draft survey |
| `/drafts/:id` | GET | Retrieve a specific draft survey |
| `/drafts/:id` | PUT | Update an existing draft survey |
| `/drafts/:id/publish` | POST | Publish a draft survey to make it active |

## Media Routes
Base path: `/api/v1/media`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/upload` | POST | Upload media files |

## Question Management Routes
Base path: `/api/questions`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/` | POST | Create a new question |
| `/:id` | GET | Retrieve a specific question |
| `/survey/:survey_id` | GET | Get all questions for a specific survey |
| `/:id` | PUT | Update a specific question |
| `/:id` | DELETE | Delete a specific question |

## Option Management Routes
Base path: `/api/options`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/` | POST | Create a new option |
| `/batch` | POST | Batch create multiple options |
| `/:id` | GET | Retrieve a specific option |
| `/question/:question_id` | GET | Get all options for a specific question |
| `/:id` | PUT | Update a specific option |
| `/:id` | DELETE | Delete a specific option |

## Answer Management Routes
Base path: `/api/answers`

| Endpoint | Method | Description |
|----------|---------|------------|
| `/` | POST | Submit a single answer |
| `/bulk` | POST | Submit multiple answers in bulk |
| `/session/:session_id` | GET | Retrieve all answers for a specific session |
| `/question/:question_id` | GET | Get all answers for a specific question |

## API Structure
The API is organized into logical groups:
- Survey management (main surveys and drafts)
- Media handling
- Question management
- Option management
- Answer management

Each group handles specific functionality while maintaining RESTful principles.

## Notes
- All routes are prefixed with `/api` to distinguish them as API endpoints
- The service uses versioning for some routes (v1)
- The draft management system allows for survey creation and editing before publication
- Bulk operations are supported for answers and options to optimize performance
- Session-based answer tracking is implemented for user response management

## Dependencies
This service is built using:
- Go Fiber v2 as the web framework
- Custom handlers for each route group
