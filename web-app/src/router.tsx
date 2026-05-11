import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import NotFoundPage from "./common/pages/NotFound";
import { PetsOverviewPage } from "./pets/pages/PetsOverview";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <PetsOverviewPage /> },
      // Catch-all route for 404 - must be last
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]); 