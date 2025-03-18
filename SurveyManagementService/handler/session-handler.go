package handler

import (
   
    "SurveyManagementService/service"
)

type SessionHandler struct {
    sessionService *service.SessionService
}

func NewSessionHandler(service *service.SessionService) *SessionHandler {
    return &SessionHandler{sessionService: service}
}


