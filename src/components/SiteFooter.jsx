import React from 'react';
import { BrandMark } from './BrandMark.jsx';

export function SiteFooter({ navigate, session, isAdmin }) {
  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(path);
  }
  const showroomPath = isAdmin ? '/admin/inventory' : '/showroom';
  const link = (path, label) => <li><a href={path} onClick={(event) => follow(event, path)}>{label}</a></li>;

  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <span className="brand"><BrandMark /> Apex Auto</span>
          <p className="footer-about">Quality cars, clear pricing, and a team that helps you choose with confidence.</p>
        </div>
        <div className="footer-col">
          <h4>Shop</h4>
          <ul>
            {link(showroomPath, 'Browse showroom')}
            {link(showroomPath, 'Smart car finder')}
            {link('/#featured', 'Featured cars')}
          </ul>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            {link('/#about', 'About us')}
            {link('/contact', 'Contact')}
          </ul>
        </div>
        <div className="footer-col">
          <h4>Account</h4>
          <ul>
            {session ? link(isAdmin ? '/admin/dashboard' : '/account', isAdmin ? 'Dashboard' : 'My account') : link('/login', 'Sign in')}
            {!session && link('/login?mode=register', 'Create account')}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Apex Auto. All rights reserved.</span>
        <span>Prices shown are ex-showroom and may vary.</span>
      </div>
    </footer>
  );
}
