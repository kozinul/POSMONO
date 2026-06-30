import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../@shared/services/queryClient';
import { AppRouter } from './router';
import { AppProviders } from './providers';
import { ErrorBoundary } from '../@shared/components/ErrorBoundary';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </AppProviders>
    </QueryClientProvider>
  );
}
