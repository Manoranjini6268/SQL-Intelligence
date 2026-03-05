import type { Metadata } from 'next';
import './globals.css';
import { CopilotProvider } from '@/components/copilot-provider';

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
        <CopilotProvider>
          <div className="min-h-screen bg-background">
            {children}
          </div>
        </CopilotProvider>
      </body>
    </html>
  );
}

