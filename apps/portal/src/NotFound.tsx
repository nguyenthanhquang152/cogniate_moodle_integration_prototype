import { Link } from "react-router";

export function NotFound() {
  return <div>
    <h1 tabIndex={-1}>Page not found</h1>
    <Link to="/integrations">Go to Integrations</Link>
  </div>;
}
