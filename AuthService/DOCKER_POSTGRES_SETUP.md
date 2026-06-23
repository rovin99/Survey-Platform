# Docker PostgreSQL Setup for AuthService

## ✅ Issue Resolved

Two issues were fixed:
1. **macOS Gatekeeper**: Removed quarantine attributes that were blocking AuthService
2. **PostgreSQL Connection**: Configured AuthService to use Docker PostgreSQL on port 5433

## Current Configuration

### Port Setup
- **Docker PostgreSQL**: Port 5433 (host) → 5432 (container)
- **Reason**: Port 5432 is occupied by PostgreSQL 17 installation at `/Library/PostgreSQL/17/`

### Database Credentials
```
Host: localhost
Port: 5433
Database: SurveyDb
Username: postgres
Password: postgres123
```

## Quick Commands

### Start PostgreSQL Container
```bash
cd AuthService/docker
docker-compose up -d postgres
```

### Stop PostgreSQL Container
```bash
cd AuthService/docker
docker-compose down
```

### View Container Logs
```bash
docker logs survey-postgres -f
```

### Check Container Status
```bash
docker ps | grep postgres
```

### Test Database Connection
```bash
PGPASSWORD=postgres123 psql -h localhost -p 5433 -U postgres -d SurveyDb
```

### Run AuthService
```bash
cd AuthService
dotnet run
```

## Files Modified

1. **`.env`** - Updated `CONNECTION_STRING` to use port 5433
2. **`docker-compose.yml`** - Changed port mapping from `5432:5432` to `5433:5432`

## Troubleshooting

### If you get Gatekeeper warnings again:
```bash
cd AuthService
./clear-quarantine.sh
```

### If PostgreSQL won't start:
```bash
# Check what's using the port
lsof -i :5433

# Or restart the container
docker-compose restart postgres
```

### If you want to use port 5432 instead:
You'll need to stop the PostgreSQL 17 service first:
```bash
# Find the process
ps aux | grep postgres | grep 5432

# Then either disable it from System Preferences
# or use: sudo kill <PID>
```

## Database Management

### Access pgAdmin (Optional)
The docker-compose includes pgAdmin on port 8080:
```bash
docker-compose up -d pgadmin
```
Then open: http://localhost:8080
- Email: admin@survey.com
- Password: admin123

### Reset Database
```bash
# Stop container and remove volume
docker-compose down -v

# Start fresh
docker-compose up -d postgres
```

## Summary

✅ AuthService is now configured to use Docker PostgreSQL
✅ Database is accessible on `localhost:5433`
✅ macOS Gatekeeper issue resolved
✅ Ready for development!

