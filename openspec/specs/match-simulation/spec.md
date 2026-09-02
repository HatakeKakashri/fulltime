# match-simulation

## Purpose
Defines the deterministic, event-based match engine that resolves fixtures into results, and the boundary of what MVP delivers to the client.

## Requirements

### Requirement: Event-Based Probabilistic Simulation
The system SHALL resolve match outcomes through weighted, probabilistic event rolls informed by team and player attributes. The system SHALL NOT implement per-player positional or pathfinding simulation.

#### Scenario: Attribute-weighted event resolution
- GIVEN two teams with player attributes assigned
- WHEN a match is simulated
- THEN each simulated event's outcome probability is weighted by the relevant team/player attributes rather than by spatial position or movement simulation

### Requirement: Deterministic Reproducibility
The system SHALL implement match simulation as a pure function of `(teamA, teamB, seed) → eventLog`. Given identical inputs, the system SHALL always produce an identical event log.

#### Scenario: Repeated simulation with the same seed
- GIVEN two teams and a fixed seed value
- WHEN the match is simulated multiple times with that same seed
- THEN every simulation run produces an identical event log and final score

#### Scenario: Different seed produces different outcome
- GIVEN the same two teams
- WHEN the match is simulated with two different seed values
- THEN the resulting event logs are not required to match, and in general differ

### Requirement: Server-Only Execution
The system SHALL execute match simulation exclusively on the server. Client applications SHALL NOT execute any match simulation logic.

#### Scenario: Client requests a match result
- GIVEN a fixture has been simulated by the server
- WHEN the client requests that match's result
- THEN the client receives the already-computed result and performs no simulation of its own

### Requirement: Result-Only Client Delivery (MVP)
The system SHALL deliver only the completed match result (final score, full event log, and match stats) to the client once simulation is finished. The system SHALL NOT stream or render in-progress match state in MVP.

#### Scenario: Client receives completed result
- GIVEN a fixture has finished simulating on the server
- WHEN the client fetches that match
- THEN the client receives the final score, the complete event log, and aggregate match stats in a single response, with no partial/in-progress state exposed
