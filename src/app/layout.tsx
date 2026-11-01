import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoMorePanza • Reto Fitness Familiar & Amigos ($50 MXN / Falta)',
  description:
    'Control de días de ejercicio con foto de prueba obligatoria, conexión con Apple Watch, Samsung Health y Huawei Health, y tabla gamificada de multas de $50 MXN.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
