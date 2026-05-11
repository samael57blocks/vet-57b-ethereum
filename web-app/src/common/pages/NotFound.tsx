import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <div className="not-found-divider" />
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="not-found-link">
          Go back home
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
