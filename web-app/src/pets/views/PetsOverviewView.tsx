import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Pet, AnimalType } from "../types/pet";
import { PetOverView } from "../components/PetOverview";
import { useRegisterPet } from "../../hooks/web3/useRegisterPet";
import type { AnimalTypeRaw } from "../../hooks/web3/useRegisterPet";
import { useRegisteredOwners } from "../../hooks/web3/useRegisteredOwners";
import { PET_QUERY_KEY } from "../hooks/usePetsOverview";

/**
 * Props for the PetsOverviewView component
 */
interface PetsOverviewViewProps {
    /** List of pets to display */
    pets: Pet[];
    /** Whether pets are still loading (show inline indicator, don't block UI) */
    loading?: boolean;
}

/**
 * Form data structure for registering a new pet
 */
interface PetFormData {
    name: string;
    age: string;
    animalType: AnimalType | "";
    caretakerName: string;
    caretakerPhone: string;
}

/**
 * Form errors structure
 */
interface FormErrors {
    name?: string;
    age?: string;
    animalType?: string;
    caretakerName?: string;
    caretakerPhone?: string;
    owner?: string;
}

/** Maps AnimalType string to contract uint8 */
const ANIMAL_TYPE_RAW: Record<AnimalType, AnimalTypeRaw> = {
    Dog: 0,
    Cat: 1,
};

/**
 * PetsOverviewView Component
 * Displays a list of pets with the ability to register new ones.
 * Handles wallet connection guard, form validation,
 * transaction lifecycle feedback, and auto-refresh on success.
 */
export function PetsOverviewView({ pets, loading }: PetsOverviewViewProps) {
    const { isConnected } = useAccount();
    const { registerPet, txState } = useRegisterPet();
    const { data: registeredOwners = [] } = useRegisteredOwners();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<string>("");
    const [freeTextOwner, setFreeTextOwner] = useState<string>("");
    const [formData, setFormData] = useState<PetFormData>({
        name: "",
        age: "",
        animalType: "",
        caretakerName: "",
        caretakerPhone: "",
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [hasSubmitted, setHasSubmitted] = useState(false);

    /**
     * Watch for successful transaction → close dialog immediately,
     * then invalidate query after a short delay so the indexer has
     * time to process the event before the refetch.
     * Gated by hasSubmitted to avoid stale success on re-open.
     */
    useEffect(() => {
        if (txState.status === "success" && hasSubmitted) {
            setHasSubmitted(false);
            setIsDialogOpen(false);
            const timer = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: PET_QUERY_KEY });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [txState.status, hasSubmitted, queryClient]);

    const openDialog = () => {
        setIsDialogOpen(true);
        setFormData({ name: "", age: "", animalType: "", caretakerName: "", caretakerPhone: "" });
        setSelectedOwner("");
        setFreeTextOwner("");
        setErrors({});
        setHasSubmitted(false);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setFormData({ name: "", age: "", animalType: "", caretakerName: "", caretakerPhone: "" });
        setSelectedOwner("");
        setFreeTextOwner("");
        setErrors({});
        setHasSubmitted(false);
    };

    /** Derive the actual owner address: dropdown selection or free-text fallback */
    const ownerAddress = selectedOwner === "__custom__" ? freeTextOwner : selectedOwner;

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name || formData.name.trim().length < 2) {
            newErrors.name = "Name must have at least 2 characters";
        }

        const ageNum = Number(formData.age);
        if (!formData.age || isNaN(ageNum) || ageNum <= 0) {
            newErrors.age = "Age must be a number greater than 0";
        }

        if (!formData.animalType) {
            newErrors.animalType = "Select an animal type";
        }

        if (!formData.caretakerName || formData.caretakerName.trim().length < 2) {
            newErrors.caretakerName = "Caretaker name must have at least 2 characters";
        }

        if (!formData.caretakerPhone || formData.caretakerPhone.trim() === "") {
            newErrors.caretakerPhone = "Caretaker phone is required";
        }

        // Owner address: validate only when in dialog mode (vet-side)
        if (!ownerAddress) {
            newErrors.owner = "Select an owner or enter an address";
        } else if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
            newErrors.owner = "Invalid Ethereum address";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setHasSubmitted(true);
        registerPet({
            name: formData.name.trim(),
            age: Number(formData.age),
            animalType: ANIMAL_TYPE_RAW[formData.animalType as AnimalType],
            owner: ownerAddress as `0x${string}`,
            caretakerName: formData.caretakerName.trim(),
            caretakerPhone: formData.caretakerPhone.trim(),
        });
    };

    const handleInputChange = (field: keyof PetFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    /** Render the registration form */
    const renderForm = () => (
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

            <div className="form-group">
                <label className="form-label" htmlFor="pet-animal-type">
                    Animal Type
                </label>
                <select
                    id="pet-animal-type"
                    className={`form-input ${errors.animalType ? "error" : ""}`}
                    value={formData.animalType}
                    onChange={(e) => handleInputChange("animalType", e.target.value)}
                >
                    <option value="">Select animal type</option>
                    <option value="Dog">Dog</option>
                    <option value="Cat">Cat</option>
                </select>
                {errors.animalType && <p className="form-error">{errors.animalType}</p>}
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="pet-owner">
                    Owner
                </label>
                <select
                    id="pet-owner"
                    className={`form-input ${errors.owner ? "error" : ""}`}
                    value={selectedOwner}
                    onChange={(e) => {
                        setSelectedOwner(e.target.value);
                        if (e.target.value !== "__custom__") setFreeTextOwner("");
                        if (errors.owner) setErrors((prev) => ({ ...prev, owner: undefined }));
                    }}
                >
                    <option value="">-- Select an owner --</option>
                    {registeredOwners.map((o) => (
                        <option key={o.address} value={o.address}>
                            {o.name} ({o.address.slice(0, 6)}...{o.address.slice(-4)})
                        </option>
                    ))}
                    <option value="__custom__">Walk-in client (enter address)</option>
                </select>
                {errors.owner && <p className="form-error">{errors.owner}</p>}
                {selectedOwner === "__custom__" && (
                    <input
                        type="text"
                        className={`form-input ${errors.owner ? "error" : ""}`}
                        style={{ marginTop: "0.5rem" }}
                        placeholder="Enter owner Ethereum address (0x...)"
                        value={freeTextOwner}
                        onChange={(e) => {
                            setFreeTextOwner(e.target.value);
                            if (errors.owner) setErrors((prev) => ({ ...prev, owner: undefined }));
                        }}
                    />
                )}
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="pet-caretaker-name">
                    Caretaker Name
                </label>
                <input
                    id="pet-caretaker-name"
                    type="text"
                    className={`form-input ${errors.caretakerName ? "error" : ""}`}
                    placeholder="Enter caretaker name"
                    value={formData.caretakerName}
                    onChange={(e) => handleInputChange("caretakerName", e.target.value)}
                />
                {errors.caretakerName && <p className="form-error">{errors.caretakerName}</p>}
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="pet-caretaker-phone">
                    Caretaker Phone
                </label>
                <input
                    id="pet-caretaker-phone"
                    type="text"
                    className={`form-input ${errors.caretakerPhone ? "error" : ""}`}
                    placeholder="Enter caretaker phone"
                    value={formData.caretakerPhone}
                    onChange={(e) => handleInputChange("caretakerPhone", e.target.value)}
                />
                {errors.caretakerPhone && <p className="form-error">{errors.caretakerPhone}</p>}
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
    );

    /** Render transaction feedback UI based on current state */
    const renderTxFeedback = () => {
        switch (txState.status) {
            case "idle":
            case "pending":
                return (
                    <div className="tx-feedback">
                        <div className="spinner" />
                        <p>Confirm transaction in MetaMask...</p>
                    </div>
                );
            case "processing":
                return (
                    <div className="tx-feedback">
                        <div className="spinner" />
                        <p>Transaction processing...</p>
                    </div>
                );
            case "success":
                return (
                    <div className="tx-feedback">
                        <p>Pet registered successfully!</p>
                    </div>
                );
            case "error":
                return (
                    <div className="tx-feedback">
                        <p className="tx-error">Error: {txState.error.message}</p>
                        <button className="btn-primary" onClick={handleSubmit}>
                            Try Again
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <main className="main-content">
            <div className="page-header">
                <h1 className="page-title">Pets</h1>
                {isConnected ? (
                    <button className="btn-primary" onClick={openDialog}>
                        Register Pet
                    </button>
                ) : (
                    <p className="wallet-guard">Connect your wallet to register a pet</p>
                )}
            </div>

            {loading ? (
                <p>Loading pets...</p>
            ) : pets.length === 0 ? (
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
                        {!hasSubmitted
                            ? renderForm()
                            : renderTxFeedback()}
                    </div>
                </div>
            )}
        </main>
    );
}
