package handler

import (
   
    "github.com/rovin99/Survey-Platform/SurveyManagementService/service"
)

type SessionHandler struct {
    sessionService *service.SessionService
}

func NewSessionHandler(service *service.SessionService) *SessionHandler {
    return &SessionHandler{sessionService: service}
}


