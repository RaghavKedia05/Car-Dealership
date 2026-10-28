import React from 'react';
import { ArrowUpRight, CarFront, LogOut, UserRound } from 'lucide-react';

export function PublicHeader({ session, isAdmin, signOut, navigate, pathname }) {
  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }

  return (
    <header className="public-header">
      <a className="public-brand" href="/" onClick={(event) => follow(event, '/')} aria-label="Apex Auto home">
        <span className="apex-brand-mark"><CarFront size={22} strokeWidth={1.8} /></span>
        <span>APEX AUTO<small>INVENTORY, IN FOCUS</small></span>
      </a>
      <nav className="public-nav" aria-label={isAdmin ? 'Administration navigation' : 'Main navigation'}>
        {isAdmin ? (
          <>
            <a className={pathname === '/admin/dashboard' ? 'active' : ''} href="/admin/dashboard" onClick={(event) => follow(event, '/admin/dashboard')}>Operations</a>
            <a className={pathname === '/admin/inventory' ? 'active' : ''} href="/admin/inventory" onClick={(event) => follow(event, '/admin/inventory')}>Inventory</a>
            <a href="/" onClick={(event) => follow(event, '/')}>Public site</a>
          </>
        ) : pathname === '/' ? (
          <>
            <a href="/showroom" onClick={(event) => follow(event, session ? '/showroom' : '/login')}>Showroom</a>
            {session && <a href="/account" onClick={(event) => follow(event, '/account')}>My account</a>}
            <a href="#featured-allocations">Inventory</a>
            <a href="#services">Services</a>
            <a href="#about">About</a>
          </>
        ) : (
          <>
            <a href="/#top" onClick={(event) => follow(event, '/')}>Home</a>
            <a href="/showroom" onClick={(event) => follow(event, session ? '/showroom' : '/login')}>Showroom</a>
            {session && !isAdmin && <a href="/account" onClick={(event) => follow(event, '/account')}>My account</a>}
            <a href="/#about" onClick={(event) => follow(event, '/#about')}>About</a>
            <a href="/contact" onClick={(event) => follow(event, '/contact')}>Contact</a>
          </>
        )}
      </nav>
      <div className="public-header-actions">
        {session ? (
          <>
            <span className="apex-user"><UserRound size={15} /> {session.user.name.split(' ')[0]}</span>
            <button className="apex-signout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </>
        ) : (
          <>
            <a className="public-signin" href="/login" onClick={(event) => follow(event, '/login')}>SIGN IN <ArrowUpRight size={15} /></a>
          </>
        )}
      </div>
    </header>
  );
}
