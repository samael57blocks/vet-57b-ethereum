import { usePetsOverview } from "../hooks/usePetsOverview";
import { PetsOverviewView } from "../views/PetsOverviewView";

/**
 * PetsOverview Page Component
 * Handles data fetching and passes pets data to the view
 */
export function PetsOverviewPage() {
    const { pets } = usePetsOverview();

    return <PetsOverviewView pets={pets} />;
}
