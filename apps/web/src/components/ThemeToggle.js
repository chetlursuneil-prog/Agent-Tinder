import React, { useState, useEffect } from 'react';
import './dark-mode.css';

const ThemeToggle = () => {
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            setDarkMode(true);
        }
    }, []);

    const toggleTheme = () => {
        setDarkMode(!darkMode);
        localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
    };

    return (
        <button onClick={toggleTheme}>
            Switch to {darkMode ? 'Light' : 'Dark'} Mode
        </button>
    );
};

export default ThemeToggle;
