# web-client-delivery — Design Notes

## Stack
React + Vite + Tailwind CSS, consuming the backend exclusively through the tRPC client (see `project.md` for full stack conventions). Responsive behavior uses Tailwind's default breakpoints (sm/md/lg/xl).

## Views (MVP)
- League standings + fixture list (observational; no reward/consequence UI per `season-scheduling`)
- Match result detail (score, event log, stats) per completed match
- Club squad view (roster, attributes, starting XI) — useful for validating `squad-initialization` and `starting-xi-selection` output

## No Auth in MVP
No login, session, or account system is implemented. The client is a single implicit "observer" role. This is a direct consequence of MVP having no human-controlled manager (see `project.md` MVP scope). Auth is expected to be introduced post-MVP alongside the human-manager feature, out of scope here.
