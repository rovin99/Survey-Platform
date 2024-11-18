package validator

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Validator instance
var validate *validator.Validate

func init() {
	validate = validator.New()

	// Register custom tag name function to handle JSON tags
	validate.RegisterTagNameFunc(func(field reflect.StructField) string {
		name := field.Tag.Get("json")
		if name == "-" {
			return ""
		}
		return strings.SplitN(name, ",", 2)[0]
	})
}

// Validate validates a struct and returns error messages.
func Validate(data interface{}) error {
	err := validate.Struct(data)
	if err != nil {
		validationErrors := err.(validator.ValidationErrors)
		return formatValidationErrors(validationErrors)
	}
	return nil
}

// formatValidationErrors converts validation errors into a user-friendly error format.
func formatValidationErrors(errors validator.ValidationErrors) error {
	var errorMessages []string
	for _, err := range errors {
		errorMessages = append(errorMessages, fmt.Sprintf("Field '%s' %s", err.Field(), validationMessage(err)))
	}
	return fmt.Errorf(strings.Join(errorMessages, ", "))
}

// validationMessage returns a user-friendly validation message based on the tag.
func validationMessage(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return "is required"
	case "email":
		return "must be a valid email"
	case "min":
		return fmt.Sprintf("must be at least %s characters", err.Param())
	case "max":
		return fmt.Sprintf("must be at most %s characters", err.Param())
	case "len":
		return fmt.Sprintf("must be exactly %s characters", err.Param())
	default:
		return "is invalid"
	}
}
