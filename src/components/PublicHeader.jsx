import React, { useEffect, useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { BrandMark } from './BrandMark.jsx';

export function PublicHeader({ session, isAdmin, signOut, navigate, pathname, dark = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMenuOpen(false);
    navigate(path);
  }

  const links = isAdmin
    ? [['/admin/dashboard', 'Dashboard'], ['/admin/inventory', 'Inventory'], ['/', 'View site']]
    : session
      ? [['/', 'Home'], ['/showroom', 'Showroom'], ['/account', 'My account'], ['/contact', 'Contact']]
      : [['/', 'Home'], ['/showroom', 'Showroom'], ['/contact', 'Contact']];

  const isActive = (path) => path === pathname;
  const firstName = session?.user.name?.split(' ')[0] || 'Account';
  const initials = (session?.user.name || 'A').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className={`site-header ${dark ? 'is-dark' : ''}`}>
      <div className="container site-header-inner">
        <a className="brand" href="/" onClick={(event) => follow(event, '/')} aria-label="Apex Auto home">
          <BrandMark />
          <span>Apex Auto{isAdmin && <small>Dealer console</small>}</span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          {links.map(([path, label]) => (
            <a key={path} href={path} className={isActive(path) ? 'active' : ''} aria-current={isActive(path) ? 'page' : undefined} onClick={(event) => follow(event, path)}>{label}</a>
          ))}
        </nav>
        <div className="header-actions">
          {session ? (
            <>
              <span className="user-chip">
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="user-name">{firstName}</span>
                {isAdmin && <span className="role-tag">Admin</span>}
              </span>
              <button className="icon-btn" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </>
          ) : (
            <a className={`btn btn-sm ${dark ? 'btn-light' : 'btn-dark'}`} href="/login" onClick={(event) => follow(event, '/login')}>Sign in</a>
          )}
          <button className="icon-btn menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(([path, label]) => (
            <a key={path} href={path} className={isActive(path) ? 'active' : ''} onClick={(event) => follow(event, path)}>{label}</a>
          ))}
          {session && <button type="button" onClick={signOut}>Sign out</button>}
        </nav>
      )}
    </header>
  );
}
