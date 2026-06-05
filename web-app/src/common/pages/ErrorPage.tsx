import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";

/**
 * ErrorPage Component
 * Renders when a route error boundary catches an error.
 * Handles both HTTP error responses and generic exceptions.
 */
function ErrorPage() {
  const error = useRouteError();

  let title: string;
  let message: string;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message ?? "An unexpected error occurred.";
  } else if (error instanceof Error) {
    title = "Application Error";
    message = error.message;
  } else {
    title = "Application Error";
    message = "An unexpected error occurred.";
  }

  return (
    <div className="not-found">
      <div className="not-found-content">
        <h1 className="not-found-code">Oops</h1>
        <div className="not-found-divider" />
        <h2 className="not-found-title">{title}</h2>
        <p className="not-found-description">{message}</p>
        <Link to="/" className="not-found-link">
          Go back home
        </Link>
      </div>
    </div>
  );
}

export default ErrorPage;
