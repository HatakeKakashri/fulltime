# web-client-delivery — Design Notes

## Stack
React + Vite + Tailwind CSS, consuming the backend exclusively through the tRPC client (see `project.md` for full stack conventions). Responsive behavior uses Tailwind's default breakpoints (sm/md/lg/xl).

## Views (MVP)
- League standings + fixture list (observational; no reward/consequence UI per `season-scheduling`)
- Match result detail (score, event log, stats) per completed match
- Club squad view (roster, attributes, starting XI) — useful for validating `squad-initialization` and `starting-xi-selection` output

## No Auth in MVP
No login, session, or account system is implemented. The client is a single implicit "observer" role. This is a direct consequence of MVP having no human-controlled manager (see `project.md` MVP scope). Auth is expected to be introduced post-MVP alongside the human-manager feature, out of scope here.

## Mobile Landscape Enforcement (Match Detail Page)

### Implementation Approach
CSS-only "rotate your device" overlay using Tailwind's built-in `portrait:` and `landscape:` variants (available since Tailwind v3.0). No JavaScript `screen.orientation.lock()` — that API only works in fullscreen or installed PWAs, not in normal browser tabs.

### Why CSS Overlay Instead of JS lock()?
- `screen.orientation.lock('landscape')` requires fullscreen or user gesture and throws `NotSupportedError` / `NotAllowedError` in normal mobile Safari/Chrome tabs
- CSS `orientation` media query works everywhere — iOS Safari, Android Chrome, desktop browsers
- Sports and media apps universally use the overlay approach for content pages; JS lock is reserved for video/gaming contexts

### Tailwind Pattern
```tsx
// Match detail content — hidden in portrait on mobile (max-md:)
<div className="max-md:portrait:hidden">
  <Scoreboard />
  <EventLog />
  <StatsTable />
</div>

// Rotate prompt — visible only in portrait on mobile
<div className="hidden max-md:portrait:flex fixed inset-0 z-50 
                flex-col items-center justify-center bg-slate-950 text-white">
  <RotateIcon />
  <p>Rotate your device</p>
  <p className="text-sm text-slate-400">
    This match breakdown is designed for landscape viewing.
  </p>
</div>
```

### Scoping
- Use `max-md:portrait:` to avoid affecting desktop users with narrow portrait windows
- Only applies to the match result detail page — league standings and club squad views are free to render in any orientation

### Accessibility Note (WCAG 1.3.4)
WCAG 1.3.4 restricts orientation unless "essential." A stats-dense match breakdown with wide tables can reasonably argue landscape is essential on 360px mobile viewports. Document this rationale in the implementation and ensure a dismiss/continue path exists so content is not permanently locked.
