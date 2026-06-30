import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
        <Link to="/dashboard" className="text-primary-600 hover:text-primary-700 underline">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
