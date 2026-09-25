import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  icons: {
    icon: [{ url: '/brand/neural-brain-website.png', type: 'image/png' }],
    apple: [{ url: '/brand/neural-brain-website.png', type: 'image/png' }],
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
