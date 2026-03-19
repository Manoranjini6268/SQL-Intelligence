import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SQL Intelligence Platform',
  description: 'Conversational SQL intelligence with validated, safe query execution',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}

