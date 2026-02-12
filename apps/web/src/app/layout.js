import '../styles/globals.css';
import { AuthProvider } from '../lib/auth-context';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'AgentTinder',
  description: 'Matchmaking marketplace for agents',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white flex flex-col">
        <AuthProvider>
          <NavBar />
          <main className="max-w-5xl mx-auto p-6 flex-1">{children}</main>
          <footer className="py-4 px-6 text-right">
            <span className="text-xs text-gray-500">Beta</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
