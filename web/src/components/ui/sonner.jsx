import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast:       'font-sans text-sm border border-border shadow-md rounded-md',
          success:     'bg-just-green-50 text-just-green-800 border-just-green-200',
          error:       'bg-red-50 text-red-800 border-red-200',
          info:        'bg-just-blue-50 text-just-blue-800 border-just-blue-200',
          warning:     'bg-yellow-50 text-yellow-800 border-yellow-200',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
