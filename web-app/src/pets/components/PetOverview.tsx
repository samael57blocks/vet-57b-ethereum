import type { Pet } from "../types/pet";

/**
 * Defines the properties received by the PetOverview component
 */
interface PetOverviewProps {
    /** The pet information to display */
    pet: Pet;
    /** Optional registered owner name; falls back to truncated address */
    ownerName?: string;
}

/**
 * Generates a random pet image URL using a placeholder service
 */
function getRandomPetImage(petId: string): string {
    // Using picsum.photos with a seed based on pet id for consistent random images
    return `https://picsum.photos/seed/${petId}/400/300`;
}

/**
 * PetOverView Component
 * Displays a card with pet information including photo, name, and age
 */
export function PetOverView({ pet, ownerName }: PetOverviewProps) {
    const displayOwner = ownerName ?? (pet.owner ? `${pet.owner.slice(0, 6)}...${pet.owner.slice(-4)}` : "Unknown owner");

    return (
        <article className="pet-card">
            <img
                src={getRandomPetImage(pet.id)}
                alt={`Photo of ${pet.name}`}
                className="pet-card-image"
                loading="lazy"
            />
            <div className="pet-card-content">
                <h3 className="pet-card-name">{pet.name}</h3>
                <p className="pet-card-age">
                    {pet.age} {pet.age === 1 ? "year" : "years"} old
                </p>
                <p className="pet-card-owner">{displayOwner}</p>
            </div>
        </article>
    );
}
