# Architecture Docs

This folder holds the deeper technical references for CostPilot.

Use the root [README.md](/Users/mac/.codex/.chatgpt-projects/g-p-6a89f756782c819186253616b405970c/CostPilot_mirror/README.md) for the recruiter-facing overview, setup, and portfolio framing. Use the files below when someone wants implementation detail.

## Recommended reading order

- `ARCHITECTURE.md`: end-to-end system design and stage-by-stage flow
- `WEB_APP_STRUCTURE.md`: Next.js application layout
- `API_SPEC.md`: request and persistence contracts
- `DEPLOYMENT.md`: local bring-up and service configuration
- `IMPACT.md`: business and portfolio positioning
- `State.md` and `Task.md`: historical implementation notes

## What these docs cover

- inbound and outbound acquisition flows
- qualification, routing, and CRM handoff
- product intelligence, billing, retention, and expansion models
- Supabase schema and migration history
- synthetic demo-state assumptions for portfolio walkthroughs

## Public sharing note

For a clean public repository, prefer sharing:

- `README.md`
- this architecture index
- `ARCHITECTURE.md`
- `WEB_APP_STRUCTURE.md`
- `API_SPEC.md`
- `DEPLOYMENT.md`
- `Portfolio/Phase10_Demo_State.md`

Keep internal agent-working files and local environment artifacts out of the public repo.
