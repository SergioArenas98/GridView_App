# GridView edge API

TypeScript Cloudflare Worker that serves the GridView API contract.

Architecture, endpoints, storage model and synchronization design are defined
in `../../docs/technical/GridView_Backend_Scheme.md`.

Status: the Worker scaffold (Wrangler environments, TypeScript strict mode,
tests and the `/v1/status` endpoint) is created in Phase 1 of
`../../docs/technical/GridView_Implementation_Plan.md`. No production
Cloudflare resources are provisioned yet.
