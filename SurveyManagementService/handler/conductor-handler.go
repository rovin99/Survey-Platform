

package handler

import (
    "errors"
    "net/http"
    
    "github.com/gofiber/fiber/v2"
    "gorm.io/gorm"
    "strconv"
    
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/response"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/utils/validator"
)

type ConductorHandler struct {
    conductorService *service.ConductorService
}

func NewConductorHandler(cs *service.ConductorService) *ConductorHandler {
    return &ConductorHandler{conductorService: cs}
}

// func (h *ConductorHandler) RegisterConductor(c *fiber.Ctx) error {
//     var req models.ConductorRegistrationRequest
//     if err := c.BodyParser(&req); err != nil {
//         return response.BadRequest(c, "Invalid request body")
//     }

//     if err := validator.Validate(req); err != nil {
//         return response.ValidationError(c, err)
//     }

//     userID := c.Locals("userID").(uint)
//     if err := h.conductorService.RegisterConductor(userID, &req); err != nil {
//         return response.Error(c, err.Error(), "REGISTRATION_FAILED", http.StatusInternalServerError, nil)
//     }

//     return response.Success(c, nil, "Verification email sent to your official email address", http.StatusCreated)
// }

func (h *ConductorHandler) RegisterConductor(c *fiber.Ctx) error {
    var req models.ConductorRegistrationRequest
    if err := c.BodyParser(&req); err != nil {
        return response.BadRequest(c, "Invalid request body")
    }

    if err := validator.Validate(req); err != nil {
        return response.ValidationError(c, err)
    }

    // Safely retrieve and check `userID` from Locals
    userIDValue := c.Locals("userID")
    if userIDValue == nil {
        return response.BadRequest(c, "Missing userID in request context")
    }

    userID, ok := userIDValue.(uint)
    if !ok {
        return response.BadRequest(c, "Invalid userID type in request context")
    }

    if err := h.conductorService.RegisterConductor(userID, &req); err != nil {
        return response.Error(c, err.Error(), "REGISTRATION_FAILED", http.StatusInternalServerError, nil)
    }

    return response.Success(c, nil, "Verification email sent to your official email address", http.StatusCreated)
}


func (h *ConductorHandler) GetConductor(c *fiber.Ctx) error {
    conductorIDStr := c.Params("id")

    // Convert the string ID to uint
    conductorID, err := strconv.ParseUint(conductorIDStr, 10, 32)
    if err != nil {
        return response.BadRequest(c, "Invalid conductor ID")
    }

    conductor, err := h.conductorService.GetByID(uint(conductorID))
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return response.NotFound(c, "Conductor not found")
        }
        return response.InternalServerError(c, "Failed to fetch conductor")
    }

    return response.Success(c, conductor, "Conductor retrieved successfully")
}


func (h *ConductorHandler) VerifyEmail(c *fiber.Ctx) error {
    conductorID := c.Locals("conductorID").(uint)
    code := c.FormValue("code")

    if err := h.conductorService.VerifyEmail(conductorID, code); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": err.Error(),
        })
    }

    return c.JSON(fiber.Map{
        "message": "Email verified successfully",
    })
}

func (h *ConductorHandler) UpdateConductor(c *fiber.Ctx) error {
    conductorID, err := strconv.ParseUint(c.Params("id"), 10, 32)
    if err != nil {
        return response.BadRequest(c, "Invalid conductor ID")
    }

    var req models.ConductorUpdateRequest
    if err := c.BodyParser(&req); err != nil {
        return response.BadRequest(c, "Invalid request body")
    }

    if err := validator.Validate(req); err != nil {
        return response.ValidationError(c, err)
    }

    if err := h.conductorService.UpdateConductor(uint(conductorID), &req); err != nil {
        return response.Error(c, err.Error(), "UPDATE_FAILED", fiber.StatusInternalServerError, nil)
    }

    return response.Success(c, nil, "Conductor updated successfully", fiber.StatusOK)
}

func (h *ConductorHandler) DeleteConductor(c *fiber.Ctx) error {
    conductorID, err := strconv.ParseUint(c.Params("id"), 10, 32)
    if err != nil {
        return response.BadRequest(c, "Invalid conductor ID")
    }

    if err := h.conductorService.DeleteConductor(uint(conductorID)); err != nil {
        return response.Error(c, err.Error(), "DELETE_FAILED", fiber.StatusInternalServerError, nil)
    }

    return response.Success(c, nil, "Conductor deleted successfully", fiber.StatusOK)
}

func (h *ConductorHandler) ListConductors(c *fiber.Ctx) error {
    page, _ := strconv.Atoi(c.Query("page", "1"))
    limit, _ := strconv.Atoi(c.Query("limit", "10"))

    conductors, total, err := h.conductorService.ListConductors(page, limit)
    if err != nil {
        return response.Error(c, err.Error(), "FETCH_FAILED", fiber.StatusInternalServerError, nil)
    }

    return response.Success(c, fiber.Map{
        "conductors": conductors,
        "total":     total,
        "page":      page,
        "limit":     limit,
    }, "Conductors retrieved successfully", fiber.StatusOK)
}