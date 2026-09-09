# mvp-global-settings

## Purpose

Defines the global settings menu accessible via a gear icon in the navbar, providing administrative actions for the testing environment. Initially contains a single "Reset World" option that clears all database data.

## Requirements

### Requirement: Settings Gear Icon

The system SHALL display a settings gear icon in the top-right corner of the navigation bar, accessible from all pages.

#### Scenario: Gear icon visible in navbar

- **WHEN** any page is rendered
- **THEN** a settings gear icon is visible in the top-right area of the navigation bar

#### Scenario: Gear icon opens menu

- **WHEN** the user clicks the settings gear icon
- **THEN** a dropdown menu appears below the icon

### Requirement: Reset World Menu Option

The settings menu SHALL contain a "Reset World" option that clears all data from the database.

#### Scenario: Reset World option visible

- **WHEN** the settings menu is opened
- **THEN** a "Reset World" menu option is displayed

#### Scenario: Reset World triggers confirmation

- **WHEN** the user clicks "Reset World"
- **THEN** a confirmation dialog appears with the message "Are you sure?"
- **AND** the dialog contains "Yes" and "No" buttons

#### Scenario: Confirming Reset World clears database

- **WHEN** the user clicks "Yes" in the Reset World confirmation dialog
- **THEN** ALL data in the database is deleted (all seasons, clubs, players, fixtures, matches, matchdays, starting XIs)
- **AND** the application returns to the empty state (no season, "Start Season" button visible)

#### Scenario: Cancelling Reset World

- **WHEN** the user clicks "No" in the Reset World confirmation dialog
- **THEN** the confirmation dialog closes
- **AND** no data is deleted

### Requirement: Reset World Destructive Action Safety

The Reset World action SHALL require explicit user confirmation before executing, as it permanently destroys all data.

#### Scenario: Confirmation required

- **WHEN** the user initiates Reset World
- **THEN** the action SHALL NOT execute until the user explicitly confirms via the dialog
- **AND** clicking outside the dialog or pressing Escape SHALL dismiss it without executing the action
