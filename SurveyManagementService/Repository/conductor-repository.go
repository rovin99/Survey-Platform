package repository
import (


	"gorm.io/gorm" 
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)
type ConductorRepository struct {
	db *gorm.DB
}

func NewConductorRepository(db *gorm.DB) *ConductorRepository {
	return &ConductorRepository{db: db}
}

func (r *ConductorRepository) Create(conductor *models.Conductor) error {
	return r.db.Create(conductor).Error
}

func (r *ConductorRepository) GetByUserID(userID uint) (*models.Conductor, error) {
	var conductor models.Conductor
	err := r.db.Where("user_id = ?", userID).First(&conductor).Error
	return &conductor, err
}

func (r *ConductorRepository) GetByOfficialEmail(email string) (*models.Conductor, error) {
	var conductor models.Conductor
	err := r.db.Where("official_email = ?", email).First(&conductor).Error
	return &conductor, err
}

func (r *ConductorRepository) UpdateVerificationStatus(id uint, isVerified bool) error {
	return r.db.Model(&models.Conductor{}).Where("id = ?", id).Update("is_verified", isVerified).Error
}
func (r *ConductorRepository) GetByID(conductorID uint) (*models.Conductor, error) {
    var conductor models.Conductor
    if err := r.db.First(&conductor, conductorID).Error; err != nil {
        return nil, err
    }
    return &conductor, nil
}