package service

import (
    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
)

type SessionService struct {
    sessionRepo *repository.SessionRepository
}

func NewSessionService(repo *repository.SessionRepository) *SessionService {
    return &SessionService{
        sessionRepo: repo,
    }
}
