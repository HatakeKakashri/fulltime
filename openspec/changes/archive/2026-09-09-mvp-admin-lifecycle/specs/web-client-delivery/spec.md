## MODIFIED Requirements

### Requirement: Client Platform and Routing

The web client SHALL function as a read-only observation dashboard built with React, Vite, and Tailwind CSS. The client SHALL route to the Home Page, League Page, Team Page, and Match Detail Page. The standalone FixturesPage route and navigation link SHALL be removed.

#### Scenario: Routes defined
- **WHEN** the client application loads
- **THEN** the following routes are available:
  - `/` — Home Page
  - `/league/:seasonId` — League Page
  - `/team/:teamId` — Team Page
  - `/match/:matchId` — Match Detail Page
  - `/club/:clubId` — Club Squad Page
  - `*` — 404 Not Found

#### Scenario: FixturesPage removed
- **WHEN** the client application loads
- **THEN** no `/fixtures` route exists
- **AND** no "Fixtures" link appears in the navigation bar

### Requirement: Navigation Bar

The navigation bar SHALL display the application name, a link to Home, and a settings gear icon in the top-right corner.

#### Scenario: Navbar elements
- **WHEN** any page is rendered
- **THEN** the navigation bar contains:
  - Application name/logo (links to Home)
  - "Home" navigation link
  - Settings gear icon (top-right)

#### Scenario: Settings gear icon opens menu
- **WHEN** the user clicks the settings gear icon
- **THEN** a dropdown menu appears with the "Reset World" option

### Requirement: Server-Authoritative Boundary

The client SHALL NOT execute any match simulation logic. All simulation occurs on the server. The client receives only completed results.

#### Scenario: Client receives completed result
- **GIVEN** a fixture has finished simulating on the server
- **WHEN** the client fetches that match's result
- **THEN** the client receives the final score, the complete event log, and aggregate match stats in a single response, with no partial/in-progress state exposed
