# Mobile UI Design Patterns

## Design Principles
- **Glassmorphism layers**: Combine `bg-white/20`, `backdrop-blur-xl`, and subtle borders like `border-white/20` so primary panels appear as floating glass cards (see QuickActionPanel, SettingsDropdown, TriggerWordSelector).
- **Mobile-first touch targets**: Core action buttons keep at least `h-11` (≈44px). Modal confirm/cancel buttons use `h-12` to ensure comfortable taps.
- **Dark-mode pairing**: Every translucent background has a matching `dark:` class (`dark:bg-slate-800/20`, `dark:border-slate-600/20`) so the glass effect survives theme switches.
- **Animated feedback**: `framer-motion` (`AnimatePresence`, `motion.div`) delivers smooth entry/exit and tap feedback without overwhelming the UI.

## Glass Panel Container
Shared between QuickActionPanel and SettingsDropdown, keeping the glass card look consistent.

```tsx
<div className="bg-white/20 dark:bg-slate-800/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-600/20 p-2 relative">
  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-slate-900/10 pointer-events-none rounded-3xl" />
  <div className="relative z-10">
    {/* actions */}
  </div>
</div>
```
- Use large radii (`rounded-3xl`) and fixed positioning so panels feel docked yet floating.
- Keep the gradient overlay layer to reinforce depth without adding real shadows everywhere.

## Modal Overlay Pattern
WorkflowSnapshots and FilePreviewModal share the same overlay and card structure.

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
>
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: 12 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: 12 }}
    className="w-full max-w-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur border border-slate-200/40 dark:border-slate-700/40 rounded-2xl shadow-xl"
  >
    {/* modal content */}
  </motion.div>
</motion.div>
```
- The outer layer dims and blurs the background; the inner card keeps translucent glass styling.
- Animate scale and translate on open/close so large overlays still feel lightweight.

## Touch-Friendly Buttons
Buttons follow the same physical feel across QuickActionPanel, WorkflowSnapshots, TriggerWordSelector.

```tsx
<Button
  size="lg"
  variant="outline"
  className="h-11 px-5 rounded-xl border transition-all duration-150 active:translate-y-px"
>
  <Play className="w-4 h-4 mr-2" />
  Execute
</Button>
```
- Maintain at least 44px height (`h-11`) and enlarge to `h-12` on modal confirmations.
- Combine `rounded-xl`, `active:scale-95`, and `active:translate-y-px` for tactile feedback on touch screens.
- Use outline variants with translucent borders so buttons sit naturally on glass backgrounds.

## Scrollable Collections
TriggerWordSelector and OutputsGallery use similar structures for long lists while retaining the glass design.

```tsx
<ScrollArea className="h-[480px] pr-2">
  <div className="space-y-3">
    <div className="bg-white/30 dark:bg-slate-800/30 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
      {/* list item */}
    </div>
  </div>
</ScrollArea>
```
- Pair scroll containers with spaced translucent cards so each item has a clear, tapable footprint.
- Provide `p-3` or larger content padding to meet mobile touch target guidelines.

## Implementation Checklist
- [ ] Reuse the glass container utility classes for any new floating panel.
- [ ] Keep action buttons ≥44px tall with rounded corners and tactile active states.
- [ ] Wrap modal overlays in `AnimatePresence` and mirror the backdrop blur/opacity recipe.
- [ ] Always include matching `dark:` classes when using translucent backgrounds or borders.
- [ ] For list-heavy components, combine scroll areas with card-like list entries for precise taps.

Following this pattern keeps QuickActionPanel, SettingsDropdown, TriggerWordSelector, WorkflowSnapshots, OutputsGallery, and modal experiences cohesive while honoring the mobile-first, glassmorphism direction of ComfyMobileUI.
