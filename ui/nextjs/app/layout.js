import './styles/app.css';
import './styles/lista.css';
import { FeedbackProvider } from '@/components/feedback/Feedback';
import ProtoNav from '@/components/layout/ProtoNav';

export const metadata = { title: { default: 'Seleção Fluiar', template: '%s · Seleção Fluiar' }, description: 'Listas de compras para clientes de arquitetura e interiores.' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=Questrial&display=swap" />
      </head>
      <body>
        <FeedbackProvider>
          {children}
          <ProtoNav />
        </FeedbackProvider>
      </body>
    </html>
  );
}
