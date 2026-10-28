import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CarFront, LogOut, Menu, X } from 'lucide-react';

export function PublicHeader({ session, isAdmin, signOut, navigate, pathname }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);
  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); setMenuOpen(false); navigate(path);
  }
  const links = isAdmin
    ? [['/admin/dashboard', 'Dashboard'], ['/admin/inventory', 'Inventory'], ['/', 'View website']]
    : [['/', 'Home'], ['/showroom', 'Find a car'], ['/contact', 'Contact us'], ...(session ? [['/account', 'My account']] : [])];
  return (
    <header className="public-header">
      <a className="public-brand" href="/" onClick={(event) => follow(event, '/')} aria-label="Apex Auto home">
        <span className="apex-brand-mark"><CarFront size={24} strokeWidth={1.8} /></span>
        <span>APEX AUTO<small>FIND YOUR NEXT DRIVE</small></span>
      </a>
      <nav id="main-navigation" className={'public-nav ' + (menuOpen ? 'public-nav-open' : '')} aria-label="Main navigation">
        {links.map(([path, label]) => <a key={path} href={path} aria-current={pathname === path ? 'page' : undefined} className={pathname === path ? 'active' : ''} onClick={(event) => follow(event, path)}>{label}</a>)}
      </nav>
      <div className="public-header-actions">
        {session ? <button className="apex-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
          : <a className="public-signin" href="/login" onClick={(event) => follow(event, '/login')}>Sign in <ArrowUpRight size={16} /></a>}
        <button className="mobile-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </header>
  );
}
