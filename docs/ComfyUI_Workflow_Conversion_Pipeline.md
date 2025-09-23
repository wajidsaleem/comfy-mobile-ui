# ComfyUI Workflow Conversion Pipeline

## Overview
- This document records the JSON → Graph → API transformation used by ComfyMobileUI to execute ComfyUI workflows from the mobile client.
- Pipeline entry points live in `src/core/services/WorkflowGraphService.ts` and `src/infrastructure/api/ComfyApiFunctions.ts`, with preprocessing support from `src/core/services/WorkflowJsonPreprocessor.ts`.

## Stage 1 · Workflow JSON Intake & Preprocessing
- `loadWorkflowToGraph` accepts either raw JSON text or objects, normalizes them, and optionally applies `preprocessWorkflowJson` before any graph work begins (`src/core/services/WorkflowGraphService.ts:72`).
- `preprocessWorkflowJson` runs a registry of processors that patch custom widgets, hydrate dynamic fields, and repair node inputs so downstream logic sees consistent `widgets_values` (`src/core/services/WorkflowJsonPreprocessor.ts:447`).
- All adjustments happen in-place on the JSON, preserving canonical ComfyUI structure while ensuring custom nodes (e.g., Power Lora Loader) expose the right slots.

## Stage 2 · Graph Construction (JSON → ComfyGraph)
- `ComfyGraph.createComfyGraph` produces a mutable graph state with node/link maps (`src/core/domain/ComfyGraph.ts:300`).
- `ComfyGraph.configure` ingests the JSON: it keeps LiteGraph-compatible fields, preserves metadata (including `mobile_ui_metadata`), resolves arrays or object-form node lists, and instantiates `ComfyGraphNode` objects with per-slot copies (`src/core/domain/ComfyGraph.ts:45`).
- Node construction retains execution flags, widget proxies, and metadata from `/object_info`, enabling UI edits without diverging from ComfyUI semantics.

## Stage 3 · Graph Normalization Utilities
- The graph layer exposes helpers for mutation (`collectNodeLinkIds`, `removeNodeWithLinks`) and serialization back to workflow JSON via `serializeGraphToWorkflow` (`src/core/services/WorkflowGraphService.ts:52`).
- Integration tests (`tests/integration/serializationTest.ts`) validate that a JSON → Graph → JSON round trip is lossless, catching regressions in node ordering, link bookkeeping, or metadata preservation.

## Stage 4 · Graph → ComfyUI API Format
- `convertGraphToAPI` orchestrates API construction (`src/infrastructure/api/ComfyApiFunctions.ts:594`). Key sub-steps:
  1. **Deep copy** the working graph (`deepCopyGraph`) to avoid mutating UI state.
  2. **Variable registration** processes `SetNode` declarations and cleans sampler control flags (`preprocessVariablesAndSetNodes`).
  3. **GetNode resolution** rewires variable reads to real producer nodes via new link IDs (`resolveGetNodeConnections`).
  4. **Routing maps** capture bypass (mode 4) and reroute node paths before virtual nodes are removed (`buildBypassRoutingMap`, `buildRerouteRoutingMap`).
  5. **Primitive propagation** pushes literal values into widget inputs, disconnecting helper nodes (`processPrimitiveNodes`).
  6. **Virtual filtering** deletes UI-only nodes (`filterOutVirtualNodes`), retaining execution-relevant nodes.
  7. **API assembly** iterates each node, resolves connections through routing maps, and maps widget data into the `{ inputs, class_type }` schema (`transformGraphNodesToApiFormat`).
  8. **Cleanup** prunes orphaned connections to removed nodes (`removeOrphanedConnections`) and leaves the map ready for `/prompt` submission.

## Verification & Tooling
- `tests/integration/convertToApiFormatTest.ts` drives the full pipeline, writing intermediate JSON, graph, and API snapshots into `tests/output/` for inspection.
- Running `npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts tests/samples/workflows/sample-workflow.json --execute` confirms the documentation steps end-to-end.

## Quick Reference
- JSON preprocessors: `src/core/services/WorkflowJsonPreprocessor.ts`
- Graph API: `src/core/domain/ComfyGraph.ts`, `src/core/domain/ComfyGraphNode.ts`
- API builder: `convertGraphToAPI` and helpers in `src/infrastructure/api/ComfyApiFunctions.ts`
- Testing entry points: `tests/integration/serializationTest.ts`, `tests/integration/convertToApiFormatTest.ts`
