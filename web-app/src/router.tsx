import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import NotFoundPage from "./common/pages/NotFound";
import { RoleGuard } from "./common/components/RoleGuard";
import { PetsOverviewPage } from "./pets/pages/PetsOverview";
import { AppointmentsPage } from "./appointments/pages/AppointmentsPage";
import { OwnerPage } from "./owners/pages/OwnerPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <RoleGuard allow="vet">
            <PetsOverviewPage />
          </RoleGuard>
        ),
      },
      {
        path: "/appointments",
        element: (
          <RoleGuard allow="vet">
            <AppointmentsPage />
          </RoleGuard>
        ),
      },
      {
        path: "/owner",
        element: (
          <RoleGuard allow="owner">
            <OwnerPage />
          </RoleGuard>
        ),
      },
      // Catch-all route for 404 - must be last
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]); 