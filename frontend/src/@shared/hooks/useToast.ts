import Swal from 'sweetalert2';

interface ToastOptions {
  title: string;
  icon?: 'success' | 'error' | 'warning' | 'info';
  timer?: number;
}

export function toast({ title, icon = 'success', timer = 3000 }: ToastOptions) {
  Swal.fire({
    title,
    icon,
    toast: true,
    position: 'top-start',
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    didOpen: (toastEl) => {
      toastEl.onmouseenter = Swal.stopTimer;
      toastEl.onmouseleave = Swal.resumeTimer;
    },
  });
}
