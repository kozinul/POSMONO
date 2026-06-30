import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../@shared/services/queryClient';
import { AppRouter } from './router';
import { AppProviders } from './providers';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </QueryClientProvider>
  );
}
