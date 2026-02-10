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
      <body className="min-h-screen bg-gray-950 text-white">
        <AuthProvider>
          <NavBar />
          <main className="max-w-5xl mx-auto p-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
