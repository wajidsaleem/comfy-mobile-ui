# ComfyUI Workflow Data Structure Guide

## Overview

ComfyUI uses two main data formats:
- **Workflow JSON**: Standard format for storage/exchange
- **Graph**: Internal format for runtime processing

This document provides a detailed explanation of both formats and their differences.

## 1. Workflow JSON Structure

### 1.1 Top-Level Structure

```typescript
interface IComfyJson {
  id?: string;                          // Workflow ID
  revision?: number;                    // Revision number
  last_node_id: number;                 // Last node ID
  last_link_id: number;                 // Last link ID
  nodes: IComfyJsonNode[];              // Node array
  links: any[];                         // Links array (array of arrays)
  groups: any[];                        // Groups array
  config: any;                          // Configuration
  extra: any;                           // Additional data
  version: number;                      // Version
  mobile_ui_metadata?: IMobileUIMetadata; // Mobile UI metadata
}
```

**Real JSON Example:**
```json
{
  "id": "",
  "revision": 0,
  "last_node_id": 475,
  "last_link_id": 1070,
  "nodes": [/* node array */],
  "links": [/* links array */],
  "groups": [/* groups array */],
  "config": {},
  "extra": {
    "ds": {
      "scale": 0.75,
      "offset": [-1920, -1399]
    },
    "id": "d2437bc0-1273-4e07-9fc4-89bef5245029"
  },
  "version": 0.4,
  "mobile_ui_metadata": {
    "version": "1.0.0",
    "created_by": "ComfyMobileUI",
    "control_after_generate": {
      "34": "fixed"
    }
  }
}
```

### 1.2 Node Structure

```typescript
interface IComfyJsonNode {
  id: number;                           // Node ID
  type: string;                         // Node type
  title?: string;                       // Node title
  pos: [number, number];                // [x, y] position
  size: [number, number];               // [width, height] size
  widgets_values?: any[] | Record<string, any>; // Widget values (array or object)
  inputs?: IComfyNodeInputSlot[];       // Input slots
  outputs?: IComfyNodeOutputSlot[];     // Output slots
  flags?: any;                          // Flags
  order?: number;                       // Execution order
  mode?: number;                        // Mode (0: normal, 2: bypass, 4: disabled)
  color?: string;                       // Color
  bgcolor?: string;                     // Background color
  properties?: any;                     // Properties
  _meta?: {                             // Metadata
    title?: string;
    [key: string]: any;
  };
}
```

**Regular Node Example:**
```json
{
  "id": 16,
  "type": "SetNode",
  "title": "Set_negative",
  "pos": [3330, 920],
  "size": [210, 60],
  "flags": { "collapsed": true },
  "mode": 0,
  "order": 67,
  "color": "#332922",
  "bgcolor": "#593930",
  "widgets_values": ["negative"],
  "inputs": [
    {
      "name": "CONDITIONING",
      "type": "CONDITIONING",
      "link": 6
    }
  ],
  "outputs": [
    {
      "name": "*",
      "type": "*",
      "links": null
    }
  ]
}
```

### 1.3 Input Slot Structure

```typescript
interface IComfyNodeInputSlot {
  name: string;                    // Input slot name
  type: string;                    // Input type (CONDITIONING, IMAGE, etc.)
  link: number | null;             // Connected link ID (null if not connected)
  widget?: {                       // Widget information (optional)
    name: string;                  // Widget name
    [key: string]: any;            // Additional widget properties
  };
  localized_name?: string;         // Localized name
  shape?: number;                  // Slot shape
  dir?: number;                    // Direction
}
```

**Input with Widget Example:**
```json
{
  "localized_name": "ckpt_name",
  "name": "ckpt_name",
  "shape": 7,
  "type": "COMBO",
  "widget": {
    "name": "ckpt_name"
  },
  "link": null
}
```

### 1.4 Flexible widgets_values Structure

`widgets_values` can be either an **array** or an **object**:

**Array Format (Common):**
```json
{
  "widgets_values": ["negative"]
}
```

**Object Format (Complex Nodes):**
```json
{
  "widgets_values": {
    "frame_rate": 8,
    "loop_count": 0,
    "filename_prefix": "AnimateDiff",
    "format": "video/nvenc_hevc-mp4",
    "save_metadata": true,
    "videopreview": {
      "hidden": false,
      "paused": false,
      "params": {
        "filename": "AnimateDiff_00002.mp4"
      }
    }
  }
}
```

### 1.5 Group Structure

```json
{
  "id": 2,
  "title": "Pose Control",
  "bounding": [4140, 1760, 310, 305.6],
  "color": "#3f789e",
  "font_size": 24,
  "flags": {}
}
```

### 1.6 Links Structure (Array Format)

```json
{
  "links": [
    [4, 7, 0, 12, 0, "*"],
    [5, 13, 0, 15, 0, "*"],
    [6, 14, 0, 16, 0, "*"]
  ]
}
```

**Array Index Meaning:**
- `[0]`: `link_id` - Unique link ID
- `[1]`: `origin_id` - Source node ID
- `[2]`: `origin_slot` - Source node output slot
- `[3]`: `target_id` - Target node ID
- `[4]`: `target_slot` - Target node input slot
- `[5]`: `type` - Connection type

## 2. Graph Structure

### 2.1 Top-Level Structure

```typescript
interface IComfyGraph {
  _nodes: IComfyGraphNode[];            // Node array (underscore prefix)
  _links: Record<number, IComfyGraphLink>; // Links object collection
  _groups?: IComfyGraphGroup[];         // Groups array
  last_node_id?: number;
  last_link_id?: number;
  config?: IComfyGraphConfig;
  extra?: any;
  version?: number;
}
```

### 2.2 Links Structure (Object Format)

```json
{
  "_links": {
    "4": {
      "id": 4,
      "origin_id": 7,
      "origin_slot": 0,
      "target_id": 12,
      "target_slot": 0,
      "type": "*"
    },
    "5": {
      "id": 5,
      "origin_id": 13,
      "origin_slot": 0,
      "target_id": 15,
      "target_slot": 0,
      "type": "*"
    }
  }
}
```

## 3. Key Differences Comparison

### 3.1 Overall Structure Differences

| Item | Workflow JSON | Graph |
|------|---------------|-------|
| **Node Key** | `nodes` | `_nodes` |
| **Links Key** | `links` | `_links` |
| **Groups Key** | `groups` | `_groups` |
| **Purpose** | Storage/Exchange | Runtime Processing |
| **Metadata** | Includes mobile_ui_metadata | Basic info only |

### 3.2 Links Structure Differences

| Item | JSON Format (links) | Graph Format (_links) |
|------|-------------------|---------------------|
| **Structure** | Array of arrays `[[...]]` | Object `{"id": {...}}` |
| **Access** | Index-based | Key-based |
| **Efficiency** | Storage efficient | Access efficient |
| **Readability** | Low | High |

### 3.3 Node-Specific Features

- **Regular Nodes**: `widgets_values` mainly as array
- **VHS Nodes** (Video-related): `widgets_values` as object format
- **Input Slots**: Can include `widget` property for widget information

## 4. Real Usage Examples

### 4.1 widgets_values by Node Type

**SetNode (Array):**
```json
{
  "type": "SetNode",
  "widgets_values": ["negative"]
}
```

**VHS_VideoCombine (Object):**
```json
{
  "type": "VHS_VideoCombine",
  "widgets_values": {
    "frame_rate": 8,
    "format": "video/nvenc_hevc-mp4",
    "save_output": false
  }
}
```

### 4.2 Connected Input vs Widget Input

**Connected Input:**
```json
{
  "name": "CONDITIONING",
  "type": "CONDITIONING",
  "link": 6
}
```

**Widget Input:**
```json
{
  "name": "ckpt_name",
  "type": "COMBO",
  "link": null,
  "widget": { "name": "ckpt_name" }
}
```

## 5. Mobile UI Extensions

ComfyMobileUI extends the standard ComfyUI format:

```json
{
  "mobile_ui_metadata": {
    "version": "1.0.0",
    "created_by": "ComfyMobileUI",
    "control_after_generate": {
      "34": "fixed"
    }
  }
}
```

## 6. Development Considerations

1. **Type Checking**: `widgets_values` can be array or object
2. **Link Access**: JSON uses arrays, Graph uses objects
3. **Input Processing**: Check for `widget` property existence
4. **Compatibility**: Maintain compatibility with standard ComfyUI

## 7. Code Examples

```typescript
// widgets_values type checking
if (Array.isArray(node.widgets_values)) {
  // Array processing
  console.log('Array format:', node.widgets_values);
} else if (typeof node.widgets_values === 'object') {
  // Object processing
  console.log('Object format:', node.widgets_values);
}

// Input widget checking
for (const input of node.inputs) {
  if (input.widget && input.link === null) {
    console.log('Widget input:', input.widget.name);
  }
}
```

## 8. Node Types Using Object Format

Based on analysis, these node types commonly use object format for `widgets_values`:

- **VHS_VideoCombine**: Video combination with complex settings
- **VHS_LoadVideo**: Video loading with preview data
- **VHS_SplitImages**: Image splitting with parameters

## 9. Link ID Management

### 9.1 JSON Format Access
```javascript
// Finding a link by ID requires iteration
const findLink = (links, linkId) => {
  return links.find(link => link[0] === linkId);
};
```

### 9.2 Graph Format Access
```javascript
// Direct access by ID
const getLink = (links, linkId) => {
  return links[linkId.toString()];
};
```

## 10. Best Practices

1. **Always check data types** before processing
2. **Handle both array and object formats** for widgets_values
3. **Use appropriate access methods** for links (iteration vs direct access)
4. **Preserve metadata** when converting between formats
5. **Validate structure** before processing to avoid runtime errors

---

This guide provides comprehensive understanding of ComfyUI workflow data structures for development and integration purposes.