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

func (r *ConductorRepository) Update(conductor *models.Conductor) error {
    return r.db.Save(conductor).Error
}

func (r *ConductorRepository) Delete(conductorID uint) error {
    return r.db.Delete(&models.Conductor{}, conductorID).Error
}



func (r *ConductorRepository) List(page, limit int) ([]models.Conductor, int64, error) {
    var conductors []models.Conductor
    var total int64

    offset := (page - 1) * limit

    err := r.db.Model(&models.Conductor{}).Count(&total).Error
    if err != nil {
        return nil, 0, err
    }

    err = r.db.Offset(offset).Limit(limit).Find(&conductors).Error
    return conductors, total, err
}
