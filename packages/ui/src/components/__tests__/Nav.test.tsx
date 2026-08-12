import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Nav pulls `usePathname` from next/navigation (a peer dep, not a real
// Next.js router instance in this test environment), so it's mocked
// per-test via `mockReturnValue` rather than relying on a real router.
const usePathnameMock = vi.fn<[], string>();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

// Imported after the mock is registered so Nav picks up the mocked hook.
import { Nav } from '../Nav';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/recruitment', label: 'Recruitment' },
];

beforeEach(() => {
  usePathnameMock.mockReset();
});

describe('Nav — active-route matching', () => {
  it('marks the root link active only on an exact "/" match', () => {
    usePathnameMock.mockReturnValue('/');
    render(<Nav links={links} />);

    const desktopNav = screen.getByRole('link', { name: 'Dashboard' });
    expect(desktopNav).toHaveStyle({ fontWeight: '600' });
  });

  it('does not treat "/" as a prefix match for every other route', () => {
    usePathnameMock.mockReturnValue('/recruitment');
    render(<Nav links={links} />);

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    const recruitmentLink = screen.getByRole('link', { name: 'Recruitment' });

    expect(dashboardLink).toHaveStyle({ fontWeight: '400' });
    expect(recruitmentLink).toHaveStyle({ fontWeight: '600' });
  });

  it('prefix-matches nested routes for non-root links', () => {
    usePathnameMock.mockReturnValue('/recruitment/123');
    render(<Nav links={links} />);

    expect(screen.getByRole('link', { name: 'Recruitment' })).toHaveStyle({ fontWeight: '600' });
  });
});

describe('Nav — mobile toggle', () => {
  it('keeps the mobile panel unmounted until the toggle is opened, then closes it on link click', async () => {
    usePathnameMock.mockReturnValue('/');
    const user = userEvent.setup();
    render(<Nav links={links} />);

    // NOTE (Checkpoint AM): this test intentionally avoids
    // `getByRole('button'/'link', { name })` for the toggle and the
    // mobile panel's own links. Both are hidden via a *base* (non-media)
    // CSS rule that only gets overridden inside `@media (max-width:
    // 640px)` (see Nav.tsx's own doc comment) — jsdom's default
    // `window.innerWidth` never satisfies that query, and no
    // `matchMedia`/viewport shim exists in this package's test setup
    // (adding one wouldn't even help here: jsdom's own CSS cascade
    // resolution for `<style>`-tag `@media` blocks is independent of
    // the `window.matchMedia()` JS API), so those elements are always
    // `display: none` as far as jsdom's `getComputedStyle` is
    // concerned. `getByRole`'s default `hidden: false` correctly
    // excludes them from the accessibility tree as a result — this
    // isn't a bug in the query, it's this environment genuinely never
    // reaching the mobile breakpoint. `getByLabelText` (for the toggle,
    // which reads the `aria-label` attribute directly) and `getByText`
    // with a `selector` (for the panel's links, which doesn't filter by
    // visibility at all) sidestep that check instead of trying to
    // fake a narrow viewport in an environment that can't render one.
    expect(screen.getAllByText('Recruitment', { selector: 'a' })).toHaveLength(1);

    const toggle = screen.getByLabelText('Open navigation menu', { selector: 'button' });
    await user.click(toggle);

    expect(screen.getByLabelText('Close navigation menu', { selector: 'button' })).toBeInTheDocument();
    // Now two "Recruitment" anchors exist: the always-rendered desktop
    // one plus the mobile panel's copy.
    const recruitmentLinks = screen.getAllByText('Recruitment', { selector: 'a' });
    expect(recruitmentLinks).toHaveLength(2);

    // recruitmentLinks[1] is the mobile panel's copy (rendered second,
    // after the desktop nav's).
    await user.click(recruitmentLinks[1]);

    // Clicking a link inside the panel closes it again.
    expect(screen.getAllByText('Recruitment', { selector: 'a' })).toHaveLength(1);
    expect(screen.getByLabelText('Open navigation menu', { selector: 'button' })).toBeInTheDocument();
  });
});

describe('Nav — accessibility', () => {
  it('exposes the sidebar as a labeled navigation landmark', () => {
    usePathnameMock.mockReturnValue('/');
    render(<Nav links={links} />);

    // getByRole('navigation') at this environment's always-desktop
    // width (see the mobile-toggle describe block's own note) resolves
    // the sidebar specifically — the mobile panel isn't mounted here.
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
  });

  it('sets aria-current="page" on the active link only, in the always-rendered sidebar', () => {
    usePathnameMock.mockReturnValue('/recruitment');
    render(<Nav links={links} />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Recruitment' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks no link current when the pathname matches none of them', () => {
    usePathnameMock.mockReturnValue('/some-other-page');
    render(<Nav links={links} />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Recruitment' })).not.toHaveAttribute('aria-current');
  });

  it('also sets aria-current="page" on the matching link inside the mobile panel once opened', async () => {
    usePathnameMock.mockReturnValue('/recruitment');
    const user = userEvent.setup();
    render(<Nav links={links} />);

    await user.click(screen.getByLabelText('Open navigation menu', { selector: 'button' }));

    // getAllByText(..., { selector: 'a' }) (not getByRole) per this
    // file's own established mobile-panel query convention — see the
    // toggle test's own note for why role queries can't reach it here.
    const recruitmentLinks = screen.getAllByText('Recruitment', { selector: 'a' });
    expect(recruitmentLinks).toHaveLength(2);
    // recruitmentLinks[1] is the mobile panel's own copy.
    expect(recruitmentLinks[1]).toHaveAttribute('aria-current', 'page');
  });
});

describe('Nav — mobile panel resize handling', () => {
  // window.matchMedia is `undefined` under this package's own default
  // jsdom test environment (confirmed directly — see Nav.tsx's own
  // doc comment), so every test in this block installs and tears down
  // its own mock rather than relying on one this package's shared test
  // setup provides.
  afterEach(() => {
    // @ts-expect-error — deleting a property this environment doesn't
    // define by default, restoring it to that same undefined state.
    delete window.matchMedia;
  });

  it("does not throw when matchMedia is unavailable (this package's own default test environment)", () => {
    usePathnameMock.mockReturnValue('/');
    expect(() => render(<Nav links={links} />)).not.toThrow();
  });

  it('closes the mobile panel when the matchMedia listener reports the viewport crossed back above 640px', async () => {
    usePathnameMock.mockReturnValue('/');
    const user = userEvent.setup();

    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    const mql = {
      matches: true,
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

    render(<Nav links={links} />);

    await user.click(screen.getByLabelText('Open navigation menu', { selector: 'button' }));
    expect(screen.getByLabelText('Close navigation menu', { selector: 'button' })).toBeInTheDocument();

    // Simulate the viewport crossing back above 640px.
    act(() => {
      changeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(screen.getByLabelText('Open navigation menu', { selector: 'button' })).toBeInTheDocument();
  });

  it('never opens the panel via the matchMedia listener — only the toggle button does', () => {
    usePathnameMock.mockReturnValue('/');

    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
    const mql = {
      matches: false,
      addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

    render(<Nav links={links} />);

    // Simulate the viewport crossing below 640px — should NOT open the panel.
    changeHandler?.({ matches: true } as MediaQueryListEvent);

    expect(screen.getByLabelText('Open navigation menu', { selector: 'button' })).toBeInTheDocument();
  });

  it('removes its matchMedia change listener on unmount', () => {
    usePathnameMock.mockReturnValue('/');

    const mql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

    const { unmount } = render(<Nav links={links} />);
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
