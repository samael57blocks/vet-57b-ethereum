import { usePetsOverview } from "../hooks/usePetsOverview";
import { PetsOverviewView } from "../views/PetsOverviewView";

/**
 * PetsOverview Page Component
 * Handles data fetching and passes pets data to the view
 */
export function PetsOverviewPage() {
    const { pets, loading, error } = usePetsOverview();

    if (loading) return <div className="main-content"><p>Loading pets...</p></div>;
    if (error) return <div className="main-content"><p>Error: {error}</p></div>;

    return <PetsOverviewView pets={pets} />;
}
