# ComfyMobileUI

*Read this in other languages: [한국어](README_KOR.md)*

<div align="center">

![ComfyMobileUI Icon](./public/icons/icon-192x192.png)

**A mobile-first, modern web interface for ComfyUI**
*Bringing professional AI image generation workflows to your fingertips*

![TypeScript-React](https://img.shields.io/badge/TypeScript-React-blue?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-Next_Generation_Frontend-646CFF?style=for-the-badge&logo=vite)
![Mobile First](https://img.shields.io/badge/Mobile-First_Design-success?style=for-the-badge&logo=mobile)
![PWA](https://img.shields.io/badge/PWA-Progressive_Web_App-purple?style=for-the-badge&logo=pwa)

[⭐ **Star this project if you find it useful!** ⭐](#show-your-support)

</div>

---

## History & Motivation

I found myself spending long hours sitting at a computer desk to use ComfyUI, which became uncomfortable over time. Most of the work involved simply **experimenting** with workflows (tweaking parameters, testing different configurations, and iterating through ideas).

I wanted to enjoy these amazing features comfortably from my couch without being tied to a desk. Initially, I tried accessing ComfyUI through a mobile browser, but while ComfyUI excels at complex workflow creation, the mobile experience was quite inconvenient. So I created a mobile-first interface optimized for **workflow usage and experimentation**.

**ComfyMobileUI** was born from this need and focuses on:
- **Use workflows comfortably** from anywhere
- **Focus on experimentation** rather than complex creation
- **Leverage mobile convenience** for quick parameter adjustments
- **Streamline the workflow usage** process

**For complex workflow creation, we still recommend using the ComfyUI desktop interface, then importing and using those workflows in ComfyMobileUI.**

## Philosophy

**ComfyMobileUI** is designed for **workflow usage**, not complex creation. While ComfyUI desktop remains the best tool for building intricate workflows, this app excels at:

- **Using existing workflows** with mobile-friendly controls
- **Making parameter adjustments** and fine-tuning
- **Quick experimentation** and iteration
- **Comfortable mobile experience** for AI generation

For complex workflow creation, we recommend using the full ComfyUI desktop interface, then importing and using those workflows in ComfyMobileUI.

---

## Features

### **Core Workflow Features**
- **Workflow Upload**: Import standard ComfyUI workflow files (non-API format)
- **Snapshot System**: Save and restore specific workflow states with full history
- **Workflow Execution**: One-tap execution with real-time progress tracking
- **Queue Management**: View, interrupt, and manage execution queue
- **Simple Node Editing**: Basic node positioning and connection modifications
- **Widget Value Editing**: Modify node parameters with mobile-optimized controls

### **Convenience Features**
- **Watchdog Reboot**: Restart ComfyUI server processes (even when server is completely unresponsive!)
- **Server Sync**: Download & upload workflows from/to ComfyUI server
- **Model Downloads**: Download models using URL links
- **Simple Model Explorer**: Browse models with trigger word storage & lookup
- **Media Browser**: View and manage images/videos from input, output, temp folders
- **Data Backup**: Browser data backup and restore functionality

### **Workflow Convenience Tools**
- **Built-in Fast Group Bypassor**: Quickly bypass/enable node groups
- **Built-in Fast Group Mutor**: Quickly mute/unmute node groups
- **Randomize Seeds**: Manually randomize all seeds in workflow
- **Trigger Word Search**: Pre-save trigger words and easily copy them in workflows

### **Mobile-Optimized Interface**
- **Progressive Web App**: Install on mobile devices for native-like experience
- **Touch Gestures**: Long press, pinch to zoom, drag to pan
- **Responsive Design**: Seamless experience across all device sizes
- **Optimized Performance**: Efficient rendering for mobile hardware

---

## Node Patch System

### **Advanced Feature for Power Users**

ComfyUI's diverse custom nodes often include special rules written as JS scripts by node authors, which are tightly integrated with ComfyUI's extension system. Additionally, some custom nodes didn't have essential input information in `/object_info`, making API format conversion difficult (especially **Power Lora Loader (rgthree)** nodes). To solve this, we've implemented a **Node Patch System** that allows patching widget slots for specific node types.

### **Patch Scopes**
- **Global**: Apply to all nodes of a specific type across all workflows
- **Workflow**: Apply to specific node types within a particular workflow
- **Specific Node**: Apply only to a specific node ID within a workflow

### **Use Cases**
- **Add missing widgets** that don't appear in object_info
- **Override widget types** (possibly convert Int widget to Combo for predefined values)
- **Fix compatibility issues** with some custom nodes
- **Customize node behavior** for mobile usage

*The utility of this system is still being explored, but it provides functionality for advanced users.*

---

## Installation

### **Prerequisites**
- Node.js 18+ and npm
- ComfyUI server running (typically on `http://localhost:8188`)
- **REQUIRED**: ComfyMobileUI API Extension

### **Critical: API Extension Setup**

**This step is MANDATORY** - ComfyMobileUI requires its API extension to function properly.

1. **Copy API Extension**:
   ```bash
   # Copy the entire comfy-mobile-ui-api-extension folder to your ComfyUI custom_nodes directory
   cp -r comfy-mobile-ui-api-extension /path/to/your/comfyui/custom_nodes/
   ```

2. **Restart ComfyUI**:
   ```bash
   # Start ComfyUI - the API extension will auto-install and run
   python main.py --enable-cors-header
   ```

**Important**: The API extension provides core functionality (almost all features) that ComfyMobileUI depends on. Without it, the app will not work correctly.

### **Development Setup**

```bash
# Clone the repository
git clone https://github.com/jaeone94/comfy-mobile-ui.git
cd ComfyMobileUI

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# Navigate to http://localhost:5173
```

### **Production Build**

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### **ComfyUI Server Setup**

Ensure your ComfyUI installation:

1. **Install API Extension**: Copy `comfy-mobile-ui-api-extension` to `custom_nodes/`
2. **Enable CORS**: Start with `--enable-cors-header` flag
3. **Network Access**: Use `--listen 0.0.0.0` for network access (optional)

```bash
# Example ComfyUI startup command
python main.py --enable-cors-header --listen 0.0.0.0
```

---

## Usage

### **Getting Started**

1. **Setup API Extension**: Install the required API extension in ComfyUI
2. **Connect to ComfyUI**: App auto-detects local ComfyUI server
3. **Import Workflows**: Drag & drop JSON workflow files or use import dialog (PNG files with embedded workflow info also supported)
4. **Simple Editing**: Tap nodes to edit parameters with mobile-friendly controls
5. **Execute Workflows**: Use the floating action button to run your workflows

### **Key Interactions**

- **Single Tap**: Select nodes and open parameter editor
- **Long Press**: On node - enter connection mode; On canvas - enter node repositioning mode
- **Double Tap**: Insert new node at tapped location
- **Pinch Gesture**: Zoom in/out of canvas
- **Drag**: Pan around large workflows

### **Workflow Management**

- **Import**: Load workflows from JSON files or server
- **Edit**: Modify parameters with mobile-optimized widgets
- **Execute**: One-tap execution with real-time progress
- **Save**: Automatic browser storage with thumbnail previews
- **Export**: Save workflows as JSON files

---

## Development

### **Project Structure**

```
src/
├── components/          # React components
│   ├── canvas/         # Canvas rendering and interactions
│   ├── controls/       # UI controls and panels
│   ├── workflow/       # Workflow management components
│   └── ui/            # Reusable UI components (shadcn/ui)
├── core/              # Business logic and services
│   └── services/      # Core service implementations
├── hooks/             # Custom React hooks
├── infrastructure/    # External integrations
│   ├── api/          # ComfyUI API client
│   ├── storage/      # IndexedDB operations
│   └── websocket/    # Real-time communication
├── shared/           # Shared utilities and types
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
└── test/             # Test utilities and integration tests
```

### **Key Technologies**
- **React 19** with TypeScript for type-safe development
- **Vite** for lightning-fast development and optimized builds
- **Tailwind CSS + shadcn/ui** for consistent, accessible design system
- **Framer Motion** for smooth animations and transitions

---

## Testing

The project includes two main integration tests:

### **API Format Conversion Test**
Tests the complete workflow pipeline from JSON to API format:
- JSON → Graph conversion
- Graph → ComfyUI API format
- API structure validation
- Optional server execution test

```bash
# Run API format conversion test
npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts <workflow-file>

# With server execution
npx tsx --tsconfig tsx.config.json tests/integration/convertToApiFormatTest.ts <workflow-file> --execute
```

### **Serialization Consistency Test**
Tests the consistency of JSON ↔ Graph ↔ JSON conversion:
- Original JSON → Graph → Serialized JSON
- Validates that workflows maintain integrity through conversion cycles

```bash
# Run serialization test
npx tsx --tsconfig tsx.config.json tests/integration/serializationTest.ts <workflow-file>

# With custom server
npx tsx --tsconfig tsx.config.json tests/integration/serializationTest.ts <workflow-file> --server http://localhost:8188
```

**Note**: Both tests require a running ComfyUI server and generate detailed output files for debugging.

---

## Known Issues

### **Current Limitations**
- **Touch Issues**: Occasional touch responsiveness problems or scroll issues
  - **Solution**: Simply refresh the browser or restart the browser app
- **Mobile Performance**: Large workflows may be slow on older mobile devices
- **Browser Cache**: Changes may require hard refresh (Ctrl+F5)
- **rgthree Node Compatibility**: Some rgthree nodes may not work properly or may be missing features
  - **Solution**: If a workflow runs in ComfyUI but fails in the mobile app, try replacing problematic rgthree nodes with equivalent standard nodes

### **Workarounds**
- **Refresh Browser**: Most UI issues resolve with a simple refresh
- **Clear Cache**: Clear browser cache if issues persist
- **Restart Browser**: Close and reopen browser for persistent problems
- **Node Replacement**: Replace unsupported rgthree nodes with compatible alternatives

### **Reporting Issues**
If you encounter workflows that work in ComfyUI but fail in ComfyMobileUI:
1. **Replace problematic nodes** with standard ComfyUI nodes when possible
2. **Report the issue** on GitHub with the workflow file attached
3. **Specify which nodes** are causing problems
4. We'll work to fix compatibility issues promptly

---

## Contributing

**Contributions are always welcome!**

### **Code Quality Notice**
Most of this app was developed using "vibe coding" (rapid prototyping, using Claude Code - he's a god), so code quality may be lacking. We appreciate your understanding and welcome improvements!

### **How to Contribute**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript strict mode requirements
- Use provided ESLint configuration
- Write tests for new functionality
- Ensure mobile compatibility
- Follow existing component patterns

---

## Show Your Support

⭐ **If you find this app useful, please consider giving it a star!** ⭐

Your support helps the project grow and motivates continued development.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **ComfyUI**: The powerful backend that makes this all possible
- **shadcn/ui**: Beautiful, accessible component library
- **Tailwind CSS**: Utility-first CSS framework
- **React Team**: For the amazing React framework
- **ComfyUI Community**: For inspiration and feedback

---

## Roadmap

- [ ] **Code Quality**: Refactor and improve code quality
- [ ] **Known Bug Fixes**: Continue fixing reported bugs
- [ ] **Performance**: Better mobile performance optimization
- [ ] **UI Polish**: Enhanced mobile interface refinements

---

<div align="center">

**Built with ❤️ for the ComfyUI community**

*Enjoy ComfyUI from your couch!*

</div>