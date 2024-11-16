// package handler

// func (h *ConductorHandler) RegisterConductor(c *fiber.Ctx) error {
// 	var req models.ConductorRegistrationRequest
// 	if err := c.BodyParser(&req); err != nil {
// 		return response.BadRequest(c, "Invalid request body")
// 	}

// 	if err := validator.Validate(req); err != nil {
// 		return response.ValidationError(c, err)
// 	}

// 	userID := c.Locals("userID").(uint)
// 	if err := h.conductorService.RegisterConductor(userID, &req); err != nil {
// 		return response.Error(c, err.Error(), "REGISTRATION_FAILED", http.StatusInternalServerError, nil)
// 	}

// 	return response.Success(c, nil, "Verification email sent to your official email address", http.StatusCreated)
// }

// func (h *ConductorHandler) GetConductor(c *fiber.Ctx) error {
// 	conductorID := c.Params("id")
	
// 	conductor, err := h.conductorService.GetByID(conductorID)
// 	if err != nil {
// 		if errors.Is(err, gorm.ErrRecordNotFound) {
// 			return response.NotFound(c, "Conductor not found")
// 		}
// 		return response.InternalServerError(c, "Failed to fetch conductor")
// 	}

// 	return response.Success(c, conductor, "Conductor retrieved successfully")
// }

package handler

type ConductorHandler struct {
	conductorService *service.ConductorService
}

func NewConductorHandler(cs *service.ConductorService) *ConductorHandler {
	return &ConductorHandler{conductorService: cs}
}

func (h *ConductorHandler) RegisterConductor(c *fiber.Ctx) error {
	var req models.ConductorRegistrationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if err := validator.Validate(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	userID := c.Locals("userID").(uint)
	if err := h.conductorService.RegisterConductor(userID, &req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Verification email sent to your official email address",
	})
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
