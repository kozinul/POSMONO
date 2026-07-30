import { useCallback } from 'react';
import Swal from 'sweetalert2';

export function useSweetAlert() {
  const fire = useCallback((options: Record<string, unknown>) => Swal.fire(options), []);
  return fire;
}
