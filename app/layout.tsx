import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/brand/neural-brain-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/neural-brain-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/brand/neural-brain-180.png', sizes: '180x180', type: 'image/png' }],
  },
  title: 'SculptAI Studio / 02 — A stronger you, in motion',
  description:
    'Your personal 3D fitness studio. Build a training plan, save workouts, record check-ins and review your progress. SculptAI Version 2 private beta.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
