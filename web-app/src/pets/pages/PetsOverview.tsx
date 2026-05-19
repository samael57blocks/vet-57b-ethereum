import { usePetsOverview } from "../hooks/usePetsOverview";
import { PetsOverviewView } from "../views/PetsOverviewView";

/**
 * PetsOverview Page Component
 * Handles data fetching and passes pets data to the view.
 * Always renders the view so the UI (buttons, structure) is visible
 * even while data is loading — prevents infinite loading from blocking UI.
 */
export function PetsOverviewPage() {
    const { pets, loading, error } = usePetsOverview();

    if (error) return <div className="main-content"><p>Error: {error}</p></div>;

    return <PetsOverviewView pets={pets} loading={loading} />;
}
