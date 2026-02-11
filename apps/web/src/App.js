import React from 'react';
import ThemeToggle from './components/ThemeToggle';

function App() {
    return (
        <div className={darkMode ? 'dark-mode' : ''}>
            <header>
                <h1>My Web App</h1>
                <ThemeToggle />
            </header>
            {/* Other components */}
        </div>
    );
}

export default App;
