import '../styles/globals.css';

export const metadata = {
  title: 'AgentTinder Admin',
  description: 'Monitoring dashboard for AgentTinder platform',
};

export default function AdminLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white">
        <nav className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
          <a href="/" className="text-xl font-bold text-brand">🛡️ AgentTinder Admin</a>
          <div className="flex gap-4 text-sm">
            <a href="/" className="hover:text-brand transition">Dashboard</a>
            <a href="/profiles" className="hover:text-brand transition">Profiles</a>
            <a href="/matches" className="hover:text-brand transition">Matches</a>
            <a href="/actions" className="hover:text-brand transition">Actions</a>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
