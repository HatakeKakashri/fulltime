## MODIFIED Requirements

### Requirement: CORS configuration for cross-origin API access

The Bun API server SHALL configure CORS headers to allow cross-origin requests from the client application during local development.

#### Scenario: Browser preflight request succeeds

- **WHEN** the browser sends an OPTIONS preflight request to the API server from `http://localhost:5173`
- **THEN** the server responds with `Access-Control-Allow-Origin: http://localhost:5173`
- **AND** responds with `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- **AND** responds with `Access-Control-Allow-Headers: Content-Type, Authorization`
- **AND** responds with HTTP 204 (No Content)

#### Scenario: Cross-origin GET request succeeds

- **WHEN** the client at `http://localhost:5173` sends a GET request to the API server at `http://localhost:3001`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:5173`
- **AND** the response body is returned normally (not blocked by browser)

#### Scenario: Cross-origin POST request succeeds

- **WHEN** the client at `http://localhost:5173` sends a POST request with JSON body to the API server
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:5173`
- **AND** the request body is processed normally
