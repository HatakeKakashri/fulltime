# web-client-delivery

## Purpose

Defines the platform and architectural boundary for the web client: what it must render across devices, and what it is (and is not) allowed to compute.

## Requirements

### Requirement: Cross-Device Responsive Rendering

The web client SHALL render correctly across mobile, tablet, laptop, and desktop browser viewports.

#### Scenario: Viewport range coverage

- **GIVEN** the web client is loaded on a device with a mobile, tablet, laptop, or desktop viewport size
- **WHEN** the interface renders
- **THEN** layout and content remain usable and legible without horizontal scrolling or broken layout at any of those viewport sizes

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

### Requirement: Server-Authoritative Simulation Boundary

The client SHALL NOT execute any match simulation logic. It SHALL only render state provided by the server.

#### Scenario: Client never simulates

- **GIVEN** a fixture that has not yet been simulated
- **WHEN** the client displays that fixture
- **THEN** it shows only the fixture's scheduled/pending status, and performs no simulation of its own

### Requirement: Result-Only Match Display (MVP)

The client SHALL display only completed match results (score, event log, stats). It SHALL NOT render in-progress or live match state in MVP.

#### Scenario: Viewing a completed match

- **GIVEN** a match has finished simulating on the server
- **WHEN** a user views that match in the client
- **THEN** the client shows the final score, full event log, and stats, with no live/in-progress rendering

### Requirement: Observation-Only Access (MVP)

Since MVP has no human-controlled manager, the client SHALL function as a read-only observation interface with no user accounts, authentication, or manager-specific login.

#### Scenario: Accessing the client with no login

- **GIVEN** the MVP web client
- **WHEN** it is accessed
- **THEN** it is usable without any login or account creation step, and presents the same read-only league/match/transfer-market views to any visitor

### Requirement: Landscape-Only Match Detail on Mobile

The match result detail page SHALL render in landscape orientation on mobile devices. When the device is in portrait mode on a mobile viewport, the client SHALL display a "rotate your device" prompt and hide the match detail content.

#### Scenario: Viewing match detail on mobile in portrait

- **GIVEN** the match result detail page is loaded on a mobile device
- **WHEN** the device is in portrait orientation
- **THEN** a "rotate your device" prompt is displayed and the match detail content is hidden

#### Scenario: Viewing match detail on mobile in landscape

- **GIVEN** the match result detail page is loaded on a mobile device
- **WHEN** the device is in landscape orientation
- **THEN** the match detail content is displayed and no rotate prompt is shown

#### Scenario: Viewing match detail on desktop

- **GIVEN** the match result detail page is loaded on a desktop browser
- **WHEN** the page renders at any window size or orientation
- **THEN** the match detail content is displayed without any rotate prompt, regardless of window orientation
