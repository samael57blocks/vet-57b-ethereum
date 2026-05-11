import { useState } from "react";
import type { Pet } from "../types/pet";
import { PetOverView } from "../components/PetOverview";

/**
 * Props for the PetsOverviewView component
 */
interface PetsOverviewViewProps {
    /** List of pets to display */
    pets: Pet[];
}

/**
 * Form data structure for registering a new pet
 */
interface PetFormData {
    name: string;
    age: string;
}

/**
 * Form errors structure
 */
interface FormErrors {
    name?: string;
    age?: string;
}

/**
 * PetsOverviewView Component
 * Displays a list of pets with the ability to register new ones
 */
export function PetsOverviewView({ pets }: PetsOverviewViewProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<PetFormData>({ name: "", age: "" });
    const [errors, setErrors] = useState<FormErrors>({});

    const openDialog = () => {
        setIsDialogOpen(true);
        setFormData({ name: "", age: "" });
        setErrors({});
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setFormData({ name: "", age: "" });
        setErrors({});
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        // Validate name (at least 2 characters)
        if (!formData.name || formData.name.trim().length < 2) {
            newErrors.name = "Name must have at least 2 characters";
        }

        // Validate age (must be a number greater than 0)
        const ageNum = Number(formData.age);
        if (!formData.age || isNaN(ageNum) || ageNum <= 0) {
            newErrors.age = "Age must be a number greater than 0";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        validateForm();
    };

    const handleInputChange = (field: keyof PetFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    return (
        <main className="main-content">
            <div className="page-header">
                <h1 className="page-title">Pets</h1>
                <button className="btn-primary" onClick={openDialog}>
                    Register Pet
                </button>
            </div>

            {pets.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🐾</div>
                    <p className="empty-state-text">No pets registered yet</p>
                </div>
            ) : (
                <div className="pets-grid">
                    {pets.map((pet) => (
                        <PetOverView key={pet.id} pet={pet} />
                    ))}
                </div>
            )}

            {isDialogOpen && (
                <div className="dialog-overlay" onClick={closeDialog}>
                    <div className="dialog" onClick={(e) => e.stopPropagation()}>
                        <h2 className="dialog-title">Register New Pet</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="pet-name">
                                    Name
                                </label>
                                <input
                                    id="pet-name"
                                    type="text"
                                    className={`form-input ${errors.name ? "error" : ""}`}
                                    placeholder="Enter pet name"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                />
                                {errors.name && <p className="form-error">{errors.name}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="pet-age">
                                    Age
                                </label>
                                <input
                                    id="pet-age"
                                    type="number"
                                    className={`form-input ${errors.age ? "error" : ""}`}
                                    placeholder="Enter pet age"
                                    value={formData.age}
                                    onChange={(e) => handleInputChange("age", e.target.value)}
                                    min="1"
                                />
                                {errors.age && <p className="form-error">{errors.age}</p>}
                            </div>

                            <div className="dialog-actions">
                                <button type="button" className="btn-secondary" onClick={closeDialog}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Register Pet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
