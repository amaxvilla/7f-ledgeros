import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// AppShell renders <Nav>, which pulls usePathname from next/navigation
// (a peer dep, not a real Next.js router instance in this test
// environment) — mocked the same way Nav.test.tsx mocks it.
const usePathnameMock = vi.fn<[], string>();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

// Imported after the mock is registered so AppShell/Nav pick it up.
import { AppShell } from '../AppShell';

beforeEach(() => {
  usePathnameMock.mockReset();
  usePathnameMock.mockReturnValue('/');
});

describe('AppShell — chrome', () => {
  it('renders the brand mark', () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );

    expect(screen.getByText('7F LedgerOS')).toBeInTheDocument();
  });

  it('renders its children below the header', () => {
    render(
      <AppShell>
        <p>Dashboard body</p>
      </AppShell>,
    );

    expect(screen.getByText('Dashboard body')).toBeInTheDocument();
  });

  it("no longer positions the header relatively — Nav's mobile panel is a viewport-fixed overlay now, not anchored to the header (Sidebar conversion)", () => {
    const { container } = render(
      <AppShell isLoggedIn={true}>
        <p>content</p>
      </AppShell>,
    );

    const header = container.querySelector('header');
    expect(header).not.toHaveStyle({ position: 'relative' });
  });

  it('renders the sidebar nav outside the header, in its own row alongside the page content', () => {
    const { container } = render(
      <AppShell isLoggedIn={true}>
        <p>content</p>
      </AppShell>,
    );

    const header = container.querySelector('header');
    // Nav.tsx's own sidebar landmark is a <nav> (not <aside> — see that
    // file's own accessibility addendum for why), so it's queried by
    // its own class here rather than by tag, since AppShell may render
    // other <nav>-tagged content elsewhere and an unqualified tag query
    // would be ambiguous.
    const sidebar = container.querySelector('.x7fnav-sidebar');
    expect(sidebar).not.toBeNull();
    expect(header?.contains(sidebar)).toBe(false);
  });
});

describe('AppShell — nav composition', () => {
  it('passes all sixty-two current routes to Nav, in order', () => {
    render(
      <AppShell isLoggedIn={true}>
        <p>content</p>
      </AppShell>,
    );

    const links = screen.getAllByRole('link');
    // Desktop nav only — usePathname is mocked to '/', and the mobile
    // panel is collapsed (not rendered) by default, so these are the
    // desktop-list anchors, one per NAV_LINKS entry.
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Recruitment',
      'Payments',
      'Transfers',
      'Security',
      'CRM',
      'Fixed Assets',
      'Tax',
      'Facility Management',
      'Lease Management',
      'Tenants',
      'Mortgage',
      'Treasury',
      'Bank Integration',
      'My Security',
      'API Keys',
      'Project Risks',
      'Project Issues',
      'Budgeting',
      'AP / AR',
      'Signatures',
      'Bill of Quantities',
      'Work Packages',
      'General Ledger',
      'Chart of Accounts',
      'Intercompany',
      'Consolidation',
      'Dimensions',
      'HR',
      'Payroll',
      'Real Estate',
      'Executive',
      'HSE',
      'PMO',
      'Procurement',
      'Inventory',
      'Revenue Recognition',
      'Bank Reconciliation',
      'Land Bank',
      'Handover',
      'Property Sales',
      'Project Tasks',
      'Project Resources',
      'Integrations',
      'Roles',
      'Users',
      'Feature Flags',
      'Entities',
      'Admin Tools',
      'Workspace Admin',
      'Job Queue',
      'Workflow',
      'Notifications',
      'Power BI',
      'Financial Statements',
      'Finance Reports',
      'Reports',
      'Agents',
      'Agent Assignments',
      'Commission Plans',
      'Settings',
      'Admin Branding',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/recruitment',
      '/payments',
      '/transfers',
      '/security',
      '/crm',
      '/fixed-assets',
      '/tax',
      '/facility-management',
      '/lease-management',
      '/tenants',
      '/mortgage',
      '/treasury',
      '/bank-integration',
      '/my-security',
      '/api-gateway',
      '/project-risks',
      '/project-issues',
      '/budgeting',
      '/ap-ar',
      '/signatures',
      '/boq',
      '/work-packages',
      '/general-ledger',
      '/chart-of-accounts',
      '/intercompany',
      '/consolidation',
      '/dimensions',
      '/hr',
      '/payroll',
      '/real-estate',
      '/executive',
      '/hse',
      '/pmo',
      '/procurement',
      '/inventory',
      '/revenue-recognition',
      '/bank-reconciliation',
      '/land-bank',
      '/handover',
      '/real-estate/sales',
      '/project-tasks',
      '/project-resources',
      '/integrations',
      '/roles',
      '/users',
      '/feature-flags',
      '/entities',
      '/admin-tools',
      '/workspace-admin',
      '/queue',
      '/workflow',
      '/notifications',
      '/power-bi',
      '/financial-statements',
      '/finance-reports',
      '/reports',
      '/agents',
      '/agent-assignments',
      '/commission-plans',
      '/settings',
      '/admin-branding',
    ]);
  });

  it("highlights the route matching the current pathname", () => {
    usePathnameMock.mockReturnValue('/payments');
    render(
      <AppShell isLoggedIn={true}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Payments' })).toHaveStyle({ fontWeight: '600' });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveStyle({ fontWeight: '400' });
  });
});

describe('AppShell — auth control (Checkpoint AK)', () => {
  it('renders no auth control at all when isLoggedIn is not passed', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('hides the sidebar navigation when logged out', () => {
    render(
      <AppShell isLoggedIn={false}>
        <p>Login content</p>
      </AppShell>,
    );

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Recruitment' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Login content')).toBeInTheDocument();
  });
  it('shows a "Log in" link to /login when isLoggedIn is false', () => {
    render(
      <AppShell isLoggedIn={false}>
        <p>content</p>
      </AppShell>,
    );

    const loginLink = screen.getByRole('link', { name: 'Log in' });
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('shows a "Log out" button wired to onLogout when isLoggedIn is true', () => {
    const onLogout = vi.fn();
    render(
      <AppShell isLoggedIn={true} onLogout={onLogout}>
        <p>content</p>
      </AppShell>,
    );

    const logoutButton = screen.getByRole('button', { name: 'Log out' });
    expect(logoutButton.closest('form')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('renders no "Log out" control when isLoggedIn is true but onLogout is not supplied', () => {
    render(
      <AppShell isLoggedIn={true}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});

describe('AppShell — footer (FE-1.1)', () => {
  it('renders a footer with a copyright line', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    const footer = screen.getByText(/© \d{4} 7F LedgerOS/);
    expect(footer.closest('footer')).toBeInTheDocument();
  });

  it('renders the footer below the page content in the DOM', () => {
    const { container } = render(
      <AppShell>
        <p>page body</p>
      </AppShell>,
    );

    const shell = container.firstElementChild as HTMLElement;
    const children = Array.from(shell.children);
    const contentIndex = children.findIndex((el) => el.textContent?.includes('page body'));
    const footerIndex = children.findIndex((el) => el.tagName === 'FOOTER');

    expect(contentIndex).toBeGreaterThanOrEqual(0);
    expect(footerIndex).toBeGreaterThan(contentIndex);
  });
});

describe('AppShell — user email + notifications (FE-1.2)', () => {
  it('renders the user email next to the logout control when supplied', () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()} userEmail="ada@example.com">
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('renders no email when userEmail is not supplied', () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('renders no email when isLoggedIn is false, even if userEmail is somehow supplied', () => {
    render(
      <AppShell isLoggedIn={false} userEmail="ada@example.com">
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
  });

  it('renders NotificationsMenu when notifications and both handlers are supplied', () => {
    render(
      <AppShell
        isLoggedIn={true}
        onLogout={vi.fn()}
        notifications={{ unreadCount: 2, recent: [] }}
        onMarkNotificationRead={vi.fn()}
        onMarkAllNotificationsRead={vi.fn()}
      >
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole('button', { name: 'Notifications (2 unread)' })).toBeInTheDocument();
  });

  it('renders no NotificationsMenu when notifications is not supplied', () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });

  it('renders no NotificationsMenu when the mark-read handlers are missing, even if notifications data is present', () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()} notifications={{ unreadCount: 2, recent: [] }}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });
});

describe('AppShell — theme toggle (FE-1.6)', () => {
  it('renders the theme toggle when logged in', async () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()}>
        <p>content</p>
      </AppShell>,
    );
    expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('renders the theme toggle when logged out too, alongside the "Log in" link', async () => {
    render(
      <AppShell isLoggedIn={false}>
        <p>content</p>
      </AppShell>,
    );
    expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('renders no theme toggle when isLoggedIn is not passed at all, same as the rest of this auth-control block', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('button', { name: /Switch to (light|dark) mode/ })).not.toBeInTheDocument();
  });
});

describe('AppShell — search box (FE-1.7)', () => {
  it('renders a search box, submitting via GET to /search, when logged in', () => {
    render(
      <AppShell isLoggedIn={true} onLogout={vi.fn()}>
        <p>content</p>
      </AppShell>,
    );
    const search = screen.getByRole('search');
    expect(search).toHaveAttribute('action', '/search');
    expect(search).toHaveAttribute('method', 'GET');
    expect(within(search).getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('renders no search box when logged out', () => {
    render(
      <AppShell isLoggedIn={false}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('renders no search box when isLoggedIn is not passed at all', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });
});
