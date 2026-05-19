import { useState } from "react";
import { useAccount } from "wagmi";
import { usePetsOverview } from "../../pets/hooks/usePetsOverview";
import { useAppointments } from "../hooks/useAppointments";
import { AppointmentsView } from "../views/AppointmentsView";

/**
 * AppointmentsPage Component
 * Handles data fetching for pets (dropdown) and appointments (list),
 * maintains selectedPetId state, and passes everything to the view.
 */
export function AppointmentsPage() {
    const { isConnected } = useAccount();
    const { pets, loading: petsLoading, error: petsError } = usePetsOverview();
    const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
    const { data: appointments, isLoading: appsLoading, error: appsError } =
        useAppointments(selectedPetId);

    if (petsLoading) return <div className="main-content"><p>Loading pets...</p></div>;
    if (petsError) return <div className="main-content"><p>Error: {petsError}</p></div>;

    return (
        <AppointmentsView
            isConnected={isConnected}
            pets={pets}
            selectedPetId={selectedPetId}
            onSelectPet={setSelectedPetId}
            appointments={appointments ?? []}
            loading={appsLoading}
            error={appsError instanceof Error ? appsError.message : null}
        />
    );
}
