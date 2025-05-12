import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './NavBar.module.css';

const NavBar: React.FC = () => {
    return (
        <nav className={styles.navBar}>
            <NavLink to="/" className={styles.navLeft}>
                <img src="/favicon-64x64.png" alt="App Icon" className={styles.navIcon} />
                <span>Pomodoro Panda</span>
            </NavLink>

            <div className={styles.navLinks}>
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                    }
                >
                    Home
                </NavLink>
                <NavLink
                    to="/stats"
                    className={({ isActive }) =>
                        isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                    }
                >
                    Stats
                </NavLink>
            </div>
        </nav>
    );
};

export default NavBar;
