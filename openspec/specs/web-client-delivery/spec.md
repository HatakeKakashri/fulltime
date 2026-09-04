# web-client-delivery

## Purpose
Defines the platform and architectural boundary for the web client: what it must render across devices, and what it is (and is not) allowed to compute.

## Requirements

### Requirement: Cross-Device Responsive Rendering
The web client SHALL render correctly across mobile, tablet, laptop, and desktop browser viewports.

#### Scenario: Viewport range coverage
- GIVEN the web client is loaded on a device with a mobile, tablet, laptop, or desktop viewport size
- WHEN the interface renders
- THEN layout and content remain usable and legible without horizontal scrolling or broken layout at any of those viewport sizes

### Requirement: Server-Authoritative Simulation Boundary
The client SHALL NOT execute any match simulation logic. It SHALL only render state provided by the server.

#### Scenario: Client never simulates
- GIVEN a fixture that has not yet been simulated
- WHEN the client displays that fixture
- THEN it shows only the fixture's scheduled/pending status, and performs no simulation of its own

### Requirement: Result-Only Match Display (MVP)
The client SHALL display only completed match results (score, event log, stats). It SHALL NOT render in-progress or live match state in MVP.

#### Scenario: Viewing a completed match
- GIVEN a match has finished simulating on the server
- WHEN a user views that match in the client
- THEN the client shows the final score, full event log, and stats, with no live/in-progress rendering

### Requirement: Observation-Only Access (MVP)
Since MVP has no human-controlled manager, the client SHALL function as a read-only observation interface with no user accounts, authentication, or manager-specific login.

#### Scenario: Accessing the client with no login
- GIVEN the MVP web client
- WHEN it is accessed
- THEN it is usable without any login or account creation step, and presents the same read-only league/match/transfer-market views to any visitor

### Requirement: Landscape-Only Match Detail on Mobile
The match result detail page SHALL render in landscape orientation on mobile devices. When the device is in portrait mode on a mobile viewport, the client SHALL display a "rotate your device" prompt and hide the match detail content.

#### Scenario: Viewing match detail on mobile in portrait
- GIVEN the match result detail page is loaded on a mobile device
- WHEN the device is in portrait orientation
- THEN a "rotate your device" prompt is displayed and the match detail content is hidden

#### Scenario: Viewing match detail on mobile in landscape
- GIVEN the match result detail page is loaded on a mobile device
- WHEN the device is in landscape orientation
- THEN the match detail content is displayed and no rotate prompt is shown

#### Scenario: Viewing match detail on desktop
- GIVEN the match result detail page is loaded on a desktop browser
- WHEN the page renders at any window size or orientation
- THEN the match detail content is displayed without any rotate prompt, regardless of window orientation
