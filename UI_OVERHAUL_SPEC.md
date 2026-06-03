# UI Overhaul — Complete Step-by-Step Specification

**Project:** Auto-Battler Roguelite  
**Milestone:** Visual Identity, Responsive Design & UI Foundation  
**Status:** Planning  
**Last Updated:** June 2026

---

## Table of Contents

1. [The Core Decision](#1-the-core-decision)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1 — Responsive Audit](#3-phase-1--responsive-audit)
4. [Phase 2 — Desktop-First Redesign](#4-phase-2--desktop-first-redesign)
5. [Phase 3 — Mobile Architecture](#5-phase-3--mobile-architecture)
6. [Phase 4 — Visual Identity System](#6-phase-4--visual-identity-system)
7. [Phase 5 — Rarity Visual Design](#7-phase-5--rarity-visual-design)
8. [Phase 6 — Typography System](#8-phase-6--typography-system)
9. [Phase 7 — Leaderboard Build Inspection](#9-phase-7--leaderboard-build-inspection)
10. [Phase 8 — Information Architecture Audit](#10-phase-8--information-architecture-audit)
11. [Phase 9 — Component Library](#11-phase-9--component-library)
12. [Phase 10 — Pre-Art Foundation](#12-phase-10--pre-art-foundation)
13. [Migration Plan](#13-migration-plan)
14. [Final File Structure](#14-final-file-structure)
15. [Implementation Order](#15-implementation-order)
16. [Rules & Constraints](#16-rules--constraints)

---

## 1. The Core Decision

Before any work begins, one architectural decision must be made and committed to. Everything else depends on it.

**The decision:** The game will use a hybrid architecture.

- **HTML handles:** All menus, navigation, information screens, modals, overlays, and the HUD chrome that surrounds the combat area.
- **Phaser handles:** The combat simulation only — the arena, player, enemies, effects, and floating damage numbers.

**Why this is the right call:**

The game was originally built as a 480×640 fixed Phaser canvas. That canvas sits in the centre of a desktop monitor surrounded by empty space. Everything — menus, stats, panels, buttons — is drawn with Phaser's `Graphics` and `Text` objects at pixel-art scale.

This creates problems that cannot be solved from within Phaser:

- Phaser text does not scale cleanly to high-DPI monitors.
- Phaser layouts cannot reflow for different screen widths.
- Phaser cannot use CSS, native fonts, or browser accessibility features.
- Every UI element requires manual pixel-coordinate positioning.
- Responsive design requires rewriting every layout calculation by hand.

HTML solves all of these problems natively. Phaser solves the real-time simulation problem natively. Use each tool for what it is designed for.

**The mental model:**

```
Browser
├── HTML UI Layer          (layout, navigation, state display)
│   ├── Main Menu
│   ├── Leaderboards
│   ├── Profile
│   ├── Build Inspector
│   ├── Glossary
│   ├── Settings
│   ├── Statistics
│   └── Modals
│
└── Phaser Canvas          (simulation, rendering, combat loop)
    ├── Combat Loop
    ├── Player Entity
    ├── Enemy Entity
    ├── Effects
    ├── Damage Numbers
    └── Arena Background
```

**The contract between the two sides:**

Neither side has a direct reference to the other. They communicate exclusively through two shared objects:

- `GameEventBus` — a typed event emitter. Either side can emit events; either side can listen.
- `RunStateStore` — an observable data store. Phaser writes run state into it; HTML reads from it and updates the DOM.

**This is the only shared surface.** No HTML function calls Phaser methods. No Phaser code touches the DOM.

---

## 2. Architecture Overview

### 2.1 The Three Layers

**Layer 1 — HTML Application Shell**

The outermost container. Fills the entire browser viewport. Contains the router mount point, modal mount point, HUD overlay, and notification area. Built with HTML, CSS, and vanilla TypeScript. No framework required.

```
#app
├── #ui-layer
│   ├── #screen-root     ← router mounts screens here
│   ├── #modal-root      ← modals mount here, above screens
│   ├── #hud-root        ← HUD overlaid on canvas during combat
│   └── #toast-root      ← notifications, highest z-index layer
│
└── #canvas-mount        ← Phaser injects its canvas here
```

**Layer 2 — The Bridge**

Two shared singletons that both layers import. No circular dependencies. The bridge is the only place where Phaser state becomes visible to HTML and vice versa.

```
bridge/
├── GameEventBus.ts      ← typed event emitter (pub/sub)
└── RunStateStore.ts     ← observable run state (read-only for HTML)
```

**Layer 3 — Phaser Canvas**

Mounted inside `#canvas-mount`. Scaled by CSS to fill the available space. Internal coordinate space remains at 480×640 — no combat code changes required. `Phaser.Scale.FIT` handles the display scaling.

### 2.2 The Visibility Rule

`#canvas-mount` has `display: none` by default. It becomes visible only when the router navigates to the combat screen. When a run ends or the player returns to the hub, the canvas is hidden again and the HTML layer takes over.

The player never sees both the HTML main menu and the Phaser canvas at the same time, except for the HUD overlay during active combat.

### 2.3 The Pointer Event Rule

`#ui-layer` and `#canvas-mount` are sibling elements, both filling the full viewport with `position: absolute; inset: 0`. The UI layer sits above the canvas layer via `z-index`.

`#ui-layer` has `pointer-events: none` on the container itself. Interactive HTML elements inside it explicitly set `pointer-events: auto`. This means clicks pass through transparent areas of the HTML layer and reach the Phaser canvas beneath. Phaser combat interactions continue to work normally.

### 2.4 The Data Flow

```
Phaser GameScene
  └── writes to RunStateStore on every state change
  └── emits to GameEventBus on discrete events (floor cleared, boss killed, etc.)

HTML HUD (CombatHUD)
  └── subscribes to RunStateStore
  └── updates DOM elements directly when subscribed values change

HTML Modals (UpgradeModal, RelicModal, etc.)
  └── listens to GameEventBus for open triggers
  └── emits choices back to GameEventBus when user selects

HTML Screens (HomeScreen, ClassSelectScreen, etc.)
  └── read from ServiceLocator services directly (no bus needed)
  └── call startRun() to begin a combat session
```

---

## 3. Phase 1 — Responsive Audit

**Goal:** Understand the exact extent of the layout problem before touching a single file. Every decision in Phase 2 and 3 is informed by this audit.

**Inputs:** The current game as it stands.  
**Outputs:** A written audit document. A breakpoint decision. A layout zone vocabulary.

### Step 1.1 — Document the Current State

For every screen in the game, record the following:

- Screen name
- What it shows
- Its current canvas size (all are 480×640)
- How it would appear on a 1920×1080 monitor (black bars, empty space, scale %)
- How it would appear on a 1440×900 monitor
- How it would appear on a 768×1024 tablet
- How it would appear on a 390×844 phone

The screens to audit:

1. `HomeScene` (main menu, tabs: Play / Ranks / Profile / Settings)
2. `ClassScene` (class selection grid)
3. `GameScene` (combat with HUD)
4. `UpgradeScene` (card selection overlay)
5. `RelicScene` (relic selection overlay)
6. `MerchantScene` (shop overlay)
7. `StatsScene` (career statistics)
8. `NameEntryScene` (player name input)

For each screen, rate three things on a scale of 1–5:

- **Space efficiency** — how much of the viewport is being used (1 = terrible waste, 5 = excellent)
- **Readability** — how readable text and UI elements are (1 = squinting required, 5 = perfectly clear)
- **Information density** — whether the amount of information shown is appropriate (1 = overwhelming or empty, 5 = well balanced)

### Step 1.2 — Identify the Problem Zones

After documenting, categorise every layout problem into one of four types:

- **Wasted space** — large areas of empty background with no content
- **Cramped content** — too much information forced into too small an area
- **Hidden information** — data that requires opening a panel, pressing a key, or navigating away to see
- **Scale mismatch** — text or elements that appear too small on large screens or too large on small screens

List every problem zone found. This list becomes the acceptance criteria for Phase 2 — the redesign is only complete when every item on this list is resolved.

### Step 1.3 — Define the Breakpoint System

Three breakpoints. Not four. Four creates unnecessary complexity for a small team.

| Tier | Name | Range | Primary Target |
|---|---|---|---|
| Small | `compact` | 0px – 767px | Phones (390×844, 375×812) |
| Medium | `medium` | 768px – 1199px | Tablets, small laptops (768×1024, 1024×768) |
| Large | `wide` | 1200px and above | Desktop (1440×900, 1920×1080) |

These breakpoints are defined once as CSS custom properties in `tokens.css` and never hardcoded anywhere else.

### Step 1.4 — Define the Layout Zone Vocabulary

Every screen in the redesigned game uses the same vocabulary of zones. Define these zones now so the entire Phase 2 redesign uses consistent terminology.

| Zone | Description | Visibility |
|---|---|---|
| `shell` | Outermost container, fills the full viewport | Always |
| `nav-rail` | Persistent navigation sidebar (desktop) or bottom bar (mobile) | Always |
| `main-panel` | Primary content area — the largest zone on screen | Always |
| `side-panel` | Secondary contextual information | Desktop: always. Mobile: collapsible |
| `arena` | The Phaser canvas mount point | Combat only |
| `hud-overlay` | HTML elements floating over the arena during combat | Combat only |
| `modal-layer` | Full-screen or partial-screen overlay above all other content | On demand |

### Step 1.5 — Make and Record the Architecture Decision

At the end of Phase 1, formally record the architectural decision:

> The game will use the hybrid HTML/Phaser architecture described in Section 2 of this document. Phaser owns the combat arena. HTML owns everything else. Communication happens exclusively through `GameEventBus` and `RunStateStore`.

This decision is not revisited. All future work assumes it.

**Phase 1 is complete when:**
- Every screen has been audited and documented
- Every layout problem has been categorised and listed
- The three breakpoints are defined
- The layout zone vocabulary is defined
- The architecture decision is recorded

---

## 4. Phase 2 — Desktop-First Interface Redesign

**Goal:** On a 1440×900 or wider monitor, the player never needs to open a panel to understand their build state. The most important information is always visible without interaction.

**Inputs:** Phase 1 audit document.  
**Outputs:** Wireframes for all screens at 1440×900. The "always visible" contract.

### Step 2.1 — Define the "Always Visible" Contract

Exactly eight pieces of information are guaranteed to be visible at all times during a run on a desktop monitor. No more. No less. Every other piece of information is Tier 2 or Tier 3.

The eight always-visible items:

1. Current floor number
2. Player HP (value and bar)
3. Enemy HP (value and bar)
4. Current gold
5. Active class name and icon
6. Active keystone name (if one is held; blank otherwise)
7. Relic count
8. Build archetype label

This contract is the design constraint that shapes the entire HUD layout. If an element is not on this list, it does not belong in the always-visible zone.

### Step 2.2 — Design the Desktop Combat Layout

The combat screen is a three-column layout. The Phaser arena sits in the centre. The two HTML rails flank it.

**Left rail (240px wide):**
- Game mode badge at the top
- Floor indicator (large, prominent)
- Player HP bar with numerical value
- XP bar with level number
- Gold counter
- Active class badge (icon + name + colour)
- Speed controls (1× / 1.5× / 2×)
- A faint "Floor modifier" strip when a modifier is active

**Centre (flexible width, fills remaining space):**
- Phaser canvas, scaled to fill the container height
- CSS `aspect-ratio: 3/4` maintains the 480×640 ratio
- No HTML elements inside the arena boundary itself

**Right rail (280px wide):**
- Enemy HP bar with name and numerical value
- Enemy status indicators (poison stacks, burn)
- Horizontal divider
- Active keystone card (compact, with rarity colour)
- Relic list (icon + name, scrollable if more than 6)
- Build archetype label
- Upgrade category breakdown (compact bar chart)
- Keyboard hints at the bottom in muted text

On screens narrower than 1200px, the rails collapse. Left rail becomes a compact top bar. Right rail becomes a slide-in drawer accessed via a button.

### Step 2.3 — Design the Hub (Home Screen) Layout

The hub screen is a two-column layout at desktop widths. No tabs. No hidden content.

**Left column (60% of screen width):**
- Player profile card at the top (name, streak, avatar placeholder)
- Mode cards grid (2×2 or 2×3 depending on how many modes exist)
- Mode cards are large, visually distinct, and always visible — no carousel, no scroll

**Right column (40% of screen width):**
- Permanent upgrades section — full list visible without any expand/collapse interaction
- Last run summary (compact card)
- Personal best records (compact list)

**Navigation (left sidebar, 56px icon rail or 200px expanded):**
- Home (mode selection)
- Leaderboard
- Profile / Statistics
- Settings
- The nav rail is persistent across all hub screens

### Step 2.4 — Design the Class Selection Screen

Class selection is a full-screen overlay or dedicated screen. Not a scrolling Phaser canvas.

**Layout at 1440×900:**
- A header with the screen title and a clear back button
- A 4-column grid of class cards (all classes visible above the fold or with minimal scroll)
- Each card: class icon, name, flavour text, description, category tags
- Hovering a card expands it slightly and shows a tooltip with stats
- Selecting a card immediately starts the run (no separate confirm button needed)

**Layout at mobile:**
- 1-column list view
- Cards are tall enough to read comfortably
- The back button is prominent and touch-target sized

### Step 2.5 — Design the Upgrade Selection Layout

On desktop, upgrade selection does not need to be full-screen.

**Layout:** A slide-in panel from the right side (480px wide). The combat arena remains visible on the left at reduced opacity. The three upgrade cards are presented vertically in the panel. The player can see their character and the cleared floor while choosing.

**The panel shows:**
- A header: the reason for the selection (e.g., "Level 3" or "Boss Reward")
- Three upgrade cards stacked vertically (or arranged in a 1×3 grid)
- Below each card: current stack count and max stacks
- A subtle countdown or "take your time" indicator — no time pressure

**On mobile:** Full-screen modal. Cards shown one at a time with swipe navigation.

### Step 2.6 — Design the Relic and Merchant Layouts

**Relic selection:** Same pattern as upgrade selection. Slide-in panel on desktop. Three relic cards presented with full rarity styling. Each card shows the relic's effect, rarity tier, and whether it synergises with the current build.

**Merchant:** A modal that slides up from the bottom of the screen (desktop) or fills the screen (mobile). Three sections:
- Upgrade cards for purchase (3 cards, standard layout)
- Consumable buffs row (3 cheap one-use items)
- A reroll button with escalating cost
- A "Leave Shop" button that is always visible and easy to click

### Step 2.7 — Wireframe Every Screen

Produce a low-fidelity wireframe for every screen in the game at 1440×900. Wireframes do not need to be beautiful. They need to answer: what is on this screen, where is it positioned, and what is the visual hierarchy (what is biggest, what is smallest, what draws the eye first)?

Wireframe tool: pencil and paper, Figma, Excalidraw, or ASCII diagrams in this document. It does not matter which tool. What matters is that every screen has a wireframe before any code is written.

**Phase 2 is complete when:**
- The always-visible contract is defined and signed off
- A wireframe exists for every screen at 1440×900
- Every layout problem from the Phase 1 audit is addressed in a wireframe
- No wireframe has a "TBD" zone — every area of every screen has a defined purpose

---

## 5. Phase 3 — Mobile Architecture

**Goal:** Do not implement mobile yet. Design the architecture so that mobile can be added later without structural rewrites. One decision made badly now costs two weeks of rework later.

**Inputs:** Phase 2 wireframes.  
**Outputs:** Mobile component spec. Responsive architecture decisions. Breakpoint behaviour rules for every component.

### Step 3.1 — Define the Component Breakpoint Contract

Every component in the system must declare how it behaves at each breakpoint. This is not optional. Components that do not have a defined `compact` behaviour will break on mobile.

Three modes per component:

| Mode | When | Behaviour |
|---|---|---|
| `full` | `wide` breakpoint | Normal desktop rendering. Full labels, full spacing. |
| `compact` | `medium` breakpoint | Reduced chrome. Abbreviated labels where needed. Panels still visible. |
| `minimal` | `compact` breakpoint | Essential information only. Touch-target sizes enforced. Panels become drawers. |

Document this for every component created in Phase 9.

### Step 3.2 — Design the Mobile Combat Layout

For 390×844 (phone in portrait):

- The Phaser arena fills the top 55% of the screen. It scales to fit the full width.
- The bottom 45% is a persistent HUD tray. It contains:
  - Player HP bar and enemy HP bar (side by side)
  - Gold counter and floor indicator (inline)
  - Two icon buttons: Build (opens drawer) and Stats (opens drawer)
  - Speed toggle (compact, one button that cycles 1× → 1.5× → 2×)
- No side rails. No persistent right panel.
- All build information (keystones, relics, upgrades) lives in a full-screen drawer opened from the HUD tray.

### Step 3.3 — Define the Drawer System

On mobile, panels that are always-visible on desktop become drawers — panels that slide in from the bottom or side of the screen, covering most of the viewport when open.

Rules for the drawer system:

- Only one drawer can be open at a time.
- Opening a drawer while another is open closes the first one first.
- Drawers always have a visible close button in the top-right corner.
- Drawers always have a swipe-down gesture to close (to be implemented later).
- Drawers have a `handle` — a small pill at the top that indicates they are draggable (to be implemented later).
- The combat loop continues running behind an open drawer.

### Step 3.4 — Define Touch Target Sizes

Every interactive element on mobile must meet the minimum touch target size of 44×44px. This is Apple's HIG standard and covers the vast majority of users.

Create a CSS utility class `u-touch-target` that expands the clickable area of an element without changing its visual size. This uses a `::after` pseudo-element with negative margins to extend the hit area.

Apply this class to every button, link, card, and interactive element from day one. On desktop it has no visual effect. On mobile it prevents missed taps.

### Step 3.5 — Identify Overflow Risk Strings

Audit every text string in the game that appears in a UI element and could cause overflow at 390px width.

Categorise each string:

- **Safe:** Under 20 characters. Will not overflow at any breakpoint.
- **Watch:** 20–30 characters. May need ellipsis on mobile.
- **Risky:** Over 30 characters. Requires truncation and a tooltip on mobile.

For every "Risky" string, define the truncation rule: how many characters to show, where to add the ellipsis, and what the tooltip should say. This becomes part of the component spec.

**Phase 3 is complete when:**
- A mobile layout wireframe exists for the combat screen
- Every component has a defined `full` / `compact` / `minimal` mode
- The drawer system rules are written
- Touch target requirements are documented
- All overflow-risk strings are identified and have truncation rules

---

## 6. Phase 4 — Visual Identity System

**Goal:** Every element in the interface looks like it belongs to the same designed world. The colour palette, border language, and surface system create a consistent atmosphere without needing art.

**Inputs:** The provided colour palette.  
**Outputs:** `tokens.css` (design token file). Visual identity spec. Phaser colour bridge.

### The Colour Palette

The following colours are the only colours used in the entire interface. Nothing is added without going through this palette first.

**Base Colours (neutrals and backgrounds):**

| Name | Hex | Role |
|---|---|---|
| Void | `#000000` | Deepest background, page fill |
| Slate | `#524C52` | Muted text, disabled states |
| Stone | `#83758B` | Secondary text, inactive labels |
| Ash | `#ACAABD` | Body text on dark surfaces |
| Parchment | `#E1E5D8` | Primary text, headings |

**Warm Accent Colours (gold, fire, danger):**

| Name | Hex | Role |
|---|---|---|
| Gold | `#E6E69C` | Rare highlights, subtle glow |
| Amber | `#DEA541` | Currency, rewards, important values |
| Ember | `#C56129` | Fire damage, warnings |
| Crimson | `#943820` | Critical hits, high danger |
| Ash-Red | `#411810` | Critical backgrounds, blood dark |

**Nature Colours (healing, poison):**

| Name | Hex | Role |
|---|---|---|
| Leaf | `#7BBA73` | Active health, positive status |
| Forest | `#39996A` | Healing, nature effects |
| Teal | `#29655A` | Poison, secondary nature |

**Water Colours (lightning, ice, frost):**

| Name | Hex | Role |
|---|---|---|
| Sky | `#6AB2C5` | Lightning, active effects |
| Azure | `#4181C5` | Information, links, water effects |
| Deep | `#316D94` | Subdued water, status backgrounds |

**Arcane Colours (keystones, legendary, magic):**

| Name | Hex | Role |
|---|---|---|
| Midnight | `#293C8B` | Deep arcane, background accents |
| Void-Purple | `#411883` | Arcane dark, selection highlight |
| Arcane | `#7B34BD` | Primary interaction colour, active borders |
| Glow | `#BD59DE` | Active states, legendary shimmer |
| Lilac | `#E69DE6` | Arcane light, rare text accent |

**Danger Colours (death, corruption):**

| Name | Hex | Role |
|---|---|---|
| Rose | `#DE599C` | Cursed, corrupted, negative effect |
| Blood | `#B41C39` | Player death, heavy danger |
| Dark-Blood | `#81090A` | Deepest danger, UI crisis state |

### Step 4.1 — Map Every Colour to a Semantic Role

No colour is applied arbitrarily. Every colour usage must map to a semantic role. The roles are:

**Background Roles:**

| CSS Variable | Value | Use |
|---|---|---|
| `--bg-void` | `#000000` | Page fill, deepest layer |
| `--bg-base` | `#0a0810` | App shell background |
| `--bg-surface` | `#13101a` | Content areas, main panels |
| `--bg-raised` | `#1e1928` | Cards, interactive containers |
| `--bg-float` | `#2a2238` | Tooltips, dropdowns, popovers |
| `--bg-overlay` | `rgba(0,0,0,0.88)` | Full-screen dim overlays |
| `--bg-input` | `#1a1525` | Input fields |

**Text Roles:**

| CSS Variable | Value | Use |
|---|---|---|
| `--text-primary` | `#E1E5D8` | All body text, headings |
| `--text-secondary` | `#ACAABD` | Labels, captions, secondary info |
| `--text-muted` | `#83758B` | Hints, placeholder text |
| `--text-dim` | `#524C52` | Disabled, dead states |
| `--text-accent` | `#DEA541` | Gold values, currency |
| `--text-danger` | `#943820` | Warnings, errors |
| `--text-heal` | `#39996A` | Healing values, positive effects |

**Border Roles:**

| CSS Variable | Value | Use |
|---|---|---|
| `--border-subtle` | `rgba(172,170,189,0.10)` | Resting state borders |
| `--border-default` | `rgba(172,170,189,0.18)` | Standard panel borders |
| `--border-active` | `#7B34BD` | Selected, focused, active |
| `--border-hover` | `rgba(123,52,189,0.45)` | Hover state |
| `--border-danger` | `#943820` | Error, warning state |
| `--border-success` | `#39996A` | Success, heal state |
| `--border-legendary` | `#DEA541` | Legendary rarity |

**Interactive / Accent Roles:**

| CSS Variable | Value | Use |
|---|---|---|
| `--accent-primary` | `#7B34BD` | Primary interactive colour |
| `--accent-gold` | `#DEA541` | Currency, rewards |
| `--accent-fire` | `#C56129` | Fire/burn effects |
| `--accent-nature` | `#39996A` | Healing, poison |
| `--accent-lightning` | `#4181C5` | Lightning, arcane |
| `--accent-glow` | `#BD59DE` | Legendary, active glow |
| `--accent-danger` | `#B41C39` | Death, critical fail |

### Step 4.2 — Define the Surface Layering System

Every background in the interface is one of six named layers. Never use arbitrary hex values for backgrounds.

| Layer | Variable | Value | Description |
|---|---|---|---|
| 0 | `--bg-void` | `#000000` | Page fill, never has content |
| 1 | `--bg-base` | `#0a0810` | App shell, outermost container |
| 2 | `--bg-surface` | `#13101a` | Sections, main content areas |
| 3 | `--bg-raised` | `#1e1928` | Cards, panels, interactive elements |
| 4 | `--bg-float` | `#2a2238` | Tooltips, popovers, dropdowns |
| 5 | `--bg-overlay` | `rgba(0,0,0,0.88)` | Full-screen modal dim |

The rule: every surface sits one layer above its parent. A card (`Layer 3`) always sits inside a section (`Layer 2`). A tooltip (`Layer 4`) always floats above a card (`Layer 3`). Never skip a layer. Never put a Layer 2 element inside a Layer 4 element.

### Step 4.3 — Define the Border and Glow System

Borders communicate state. They are not decoration.

| State | Border Style | Glow |
|---|---|---|
| Resting | `1px solid var(--border-subtle)` | None |
| Hover | `1px solid var(--border-hover)` | None |
| Active / Selected | `1px solid var(--border-active)` | `0 0 6px rgba(123,52,189,0.25)` |
| Focused (keyboard) | `2px solid var(--border-active)` | `0 0 0 3px rgba(123,52,189,0.30)` |
| Danger / Error | `1px solid var(--border-danger)` | None |
| Success / Heal | `1px solid var(--border-success)` | None |
| Legendary rarity | `1px solid var(--border-legendary)` | `0 0 10px rgba(222,165,65,0.35)` |

### Step 4.4 — Define the Five Interactive States

Every interactive element must have all five states defined before it is considered complete:

1. **Default** — resting state when nothing is happening
2. **Hover** — cursor is over the element
3. **Active** — element is being pressed / clicked
4. **Focused** — element has keyboard focus (tab navigation)
5. **Disabled** — element cannot be interacted with

No element ships without all five states specified. Disabled elements must be visually distinct from resting elements — never just reduce opacity alone.

### Step 4.5 — Create the Phaser Colour Bridge

Phaser code that needs theme colours cannot read CSS variables directly. Create a small utility that reads the resolved CSS variables at scene initialisation and exposes them as a typed object for use in Phaser `Graphics.fillStyle()` and `Text.setColor()` calls.

This bridge is populated once when `GameScene.create()` runs and cached for the duration of the session.

**Phase 4 is complete when:**
- Every colour in the palette has a named CSS variable and a documented role
- The surface layering system is documented
- The border and glow system is documented
- The five interactive states are defined
- `tokens.css` is created with all variables
- The Phaser colour bridge spec is written

---

## 7. Phase 5 — Rarity Visual Design

**Goal:** A player looking at a card for half a second should know its rarity tier before reading any text. Rarity communicates through colour, shape, border weight, glow intensity, and label — never through colour alone.

**Inputs:** Phase 4 token system.  
**Outputs:** Rarity token additions to `tokens.css`. Card anatomy spec. Rarity badge component spec.

### Step 5.1 — Rename the Rarity Tiers

The current tier names are `Common / Uncommon / Rare / Legendary`. Rename them to align with genre expectations and create a clearer power progression:

| Old Name | New Name | Reason |
|---|---|---|
| Common | Common | No change needed |
| Uncommon | Rare | Aligns with Hearthstone, PoE, and genre conventions |
| Rare | Epic | Makes the power jump feel meaningful |
| Legendary | Legendary | No change needed |

Update every reference in the codebase: `UpgradeDefinition`, `RARITY_LABEL`, `RARITY_COLOR`, and all display text.

### Step 5.2 — Define the Rarity Visual System

Each tier uses multiple visual signals simultaneously. Colour alone is not sufficient — it fails for colour-blind users and fails in high-contrast environments.

**Common:**
- Colour: Stone `#83758B`
- Border: `1px solid var(--border-subtle)`
- Glow: None
- Accent bar: 3px, flat, no animation
- Badge icon: `▪` (solid square)
- Background: Standard `--bg-raised`
- Name colour: `--text-secondary`

**Rare:**
- Colour: Azure `#4181C5`
- Border: `1px solid rgba(65,129,197,0.55)`
- Glow: None
- Accent bar: 4px, flat, no animation
- Badge icon: `◆` (diamond)
- Background: Slight blue tint on `--bg-raised`
- Name colour: Azure `#4181C5`

**Epic:**
- Colour: Arcane `#7B34BD`
- Border: `1px solid rgba(123,52,189,0.65)`
- Glow: `0 0 6px rgba(123,52,189,0.20)` — always on, subtle
- Accent bar: 5px, flat, no animation
- Badge icon: `✦` (star)
- Background: Slight arcane tint on `--bg-raised`
- Name colour: Glow `#BD59DE`

**Legendary:**
- Colour: Amber `#DEA541`
- Border: `1px solid var(--border-legendary)`
- Glow: `0 0 12px rgba(222,165,65,0.30)` — always on, moderate
- Accent bar: 6px, animated shimmer on hover
- Badge icon: `♛` (crown)
- Background: Very subtle warm tint on `--bg-raised`
- Name colour: Gold `#E6E69C`

### Step 5.3 — Define Card Anatomy

Every upgrade card, relic card, and keystone card uses the same anatomical structure. Rarity inflects specific parts without changing the structure.

```
┌─[Tier Tag]─────────[Rarity Badge]─┐ ← accent bar (rarity colour, variable height)
│                                   │
│              [Icon / Symbol]       │
│                                   │
│         [Upgrade Name]            │ ← name text (rarity colour)
│    ─────────────────────────      │ ← divider
│                                   │
│         [Description]             │ ← body text (--text-secondary)
│                                   │
│      [Flavour text if any]        │ ← italic, --text-dim
│                                   │
│   [Stack count: 1/3]  [Category]  │ ← caption row
└───────────────────────────────────┘
```

The accent bar at the top changes height and animation by rarity. The name, border, and glow change colour by rarity. Everything else stays the same.

### Step 5.4 — Design the Rarity Badge Component

A compact inline component used in tables, lists, and compact views. Three sizes:

| Size | Use case | Dimensions |
|---|---|---|
| `full` | Card headers, large displays | Icon + label, ~80px wide |
| `medium` | Lists, side panels | Icon + abbreviated label, ~60px wide |
| `micro` | Table rows, leaderboard cells | Icon only with tooltip, ~20px wide |

The badge always shows the rarity icon and a coloured background matching the rarity tier. The text label is visible in `full` and `medium` sizes, hidden in `micro`.

### Step 5.5 — Apply Rarity Styling Consistently Across All Contexts

Document every place where a rarity-coloured element appears and assign it the correct visual treatment:

| Context | Rarity Treatment |
|---|---|
| Upgrade card (UpgradeModal) | Full card anatomy with rarity accent bar |
| Relic card (RelicModal) | Full card anatomy |
| Keystone card (right HUD rail) | Compact card, full rarity glow |
| Build panel upgrade list | Left accent line (rarity colour) + name text |
| Leaderboard keystone column | `micro` badge + name |
| Build Inspector upgrade list | `medium` badge + name |
| Merchant shop card | Full card anatomy + sold overlay |
| Game Over summary | `full` badge per rarity tier, count grouped |

**Phase 5 is complete when:**
- Rarity tiers are renamed in the spec (not yet in code)
- All four tiers have fully defined visual treatments
- Card anatomy is documented
- The rarity badge component is specced at all three sizes
- Every context where rarity appears has an assigned treatment

---

## 8. Phase 6 — Typography System

**Goal:** The player's eye knows where to look at every moment because the type hierarchy tells it where. Consistent sizing, weight, and colour relationships create a legible, professional reading experience at all resolutions.

**Inputs:** Phase 4 token system.  
**Outputs:** Typography token additions to `tokens.css`. Typographic specimen page. Text audit spreadsheet.

### Step 6.1 — Choose the Typeface

The game currently uses `monospace` universally. Keep it. The monospace aesthetic is correct for the genre — it reads as digital, arcane, and mechanical. What changes is the formalisation: a proper fallback stack and explicit rendering settings.

**Primary stack:** `'JetBrains Mono', 'Fira Mono', 'Cascadia Code', 'Consolas', 'Courier New', monospace`

Why JetBrains Mono first: it is widely available via Google Fonts, has excellent readability at small sizes, and its letterforms are clean enough to work at both 9px (captions) and 32px (display text).

**For numbers specifically:** Always add `font-variant-numeric: tabular-nums` to stat panels, HP counters, gold displays, and any column of numbers. Tabular numerals have equal-width characters so numbers do not visually "jump" when values change.

### Step 6.2 — Define the Type Scale

Seven levels. Defined in `rem` units with a 16px base. Never define font sizes in `px` directly in component CSS — always use the token variables.

| Token | rem | px | Weight | Colour Token | Use Case |
|---|---|---|---|---|---|
| `--text-display` | 2rem | 32px | 800 | `--text-primary` | Floor cleared, game over title, major announcements |
| `--text-title` | 1.375rem | 22px | 700 | `--text-primary` | Screen titles (HomeScreen header, ClassSelect header) |
| `--text-heading` | 1rem | 16px | 700 | `--text-primary` | Section headers, panel titles |
| `--text-body` | 0.8125rem | 13px | 400 | `--text-primary` | Normal UI text, descriptions |
| `--text-label` | 0.6875rem | 11px | 600 | `--text-secondary` | Labels, keyboard hints, small badges |
| `--text-caption` | 0.5625rem | 9px | 400 | `--text-muted` | Timestamps, fine print, version numbers |
| `--text-stat` | 1.125rem | 18px | 700 | varies | Numbers in stat panels, HP values, DPS |

### Step 6.3 — Define Spacing and Line Height Rules

| Usage | Line Height | Letter Spacing |
|---|---|---|
| Display text | 1.15 | -0.02em |
| Titles and headings | 1.2 | -0.01em |
| Body text | 1.5 | 0em |
| Labels and captions | 1.2 | 0.06em |
| Numbers and stats | 1.0 | -0.01em |
| Keyboard shortcuts `[B]` | 1.0 | 0.04em |

### Step 6.4 — Audit Every Text Element

Go through every screen in the game and list every text element. For each one, assign:
- The correct type scale token from Step 6.2
- The correct colour token from Phase 4
- Whether it needs `tabular-nums`
- Whether it needs a truncation rule

This produces a spreadsheet with one row per text element. Every row must be completed before any CSS is written for that element. There should be zero text elements in the final product that use hardcoded font sizes.

### Step 6.5 — Define the Truncation Contract

| Length | Rule |
|---|---|
| Under 20 characters | Render fully at all breakpoints |
| 20–30 characters | Render fully at `wide`, truncate at `compact` |
| Over 30 characters | Always truncate with ellipsis at 28 characters, show full text in a tooltip on hover |

Apply this contract to: upgrade names, relic names, class names, build archetype labels, floor modifier names, and player names. Apply it to nothing else — numerical values and labels should be redesigned to fit, not truncated.

### Step 6.6 — Build the Typographic Specimen Page

Create a single HTML file (`type-specimen.html`) that displays every type level in both its light and dark context, with sample text for each use case. This file:

- Is not part of the game build
- Lives in a `/design` folder at the project root
- Is used to verify that type tokens render correctly in the browser
- Is updated whenever type tokens change

**Phase 6 is complete when:**
- Typeface stack is defined
- Seven-level type scale is in `tokens.css`
- Line height and letter spacing rules are documented
- Every text element in the game has been audited and assigned a token
- The specimen page exists and renders correctly

---

## 9. Phase 7 — Leaderboard Build Inspection

**Goal:** A player looking at a top-100 run should be able to understand exactly how that build worked — not just what floor it reached. Leaderboards should teach players how to play better, not just rank them.

**Inputs:** Phase 8 IA decisions (what to show), Phase 9 components (cards, badges, stat rows).  
**Outputs:** Updated `RunResultDTO` schema. Build Inspector wireframes. Leaderboard screen spec.

### Step 7.1 — Update the Run Data Schema

The current `RunResultDTO` is missing the upgrade list. A build cannot be fully inspected without knowing which upgrades were taken. Add two fields:

| New Field | Type | Description |
|---|---|---|
| `upgrades_taken` | `Array<{ id: string; stacks: number }>` | Ordered list of upgrades taken during the run |
| `final_dps` | `number` | Calculated DPS at run end (from StatsPanel formula) |
| `final_hps` | `number` | Calculated HPS at run end |

These fields are populated in `GameScene.onPlayerDead()` when the run result is built. They are stored in `LocalRunHistoryService` alongside all existing fields.

### Step 7.2 — Design the Leaderboard List View

The leaderboard is a screen, not a tab within another screen. It has its own route (`/leaderboard`).

**Header area:**
- Screen title
- Three filter controls: Mode (dropdown), Class (dropdown), Sort by (floor / score / date)
- No search bar — the dataset is small enough for visual scanning

**List area:**
A table with the following columns:

| Column | Width | Content |
|---|---|---|
| Rank | 48px | `#1`, `#2`, etc. |
| Player | 140px | Name (truncated at 16 chars) |
| Class | 80px | Icon + name |
| Floor / Bosses | 64px | Large number (primary stat) |
| Build | 120px | Archetype label |
| Keystone | 100px | Rarity micro-badge + name |
| DPS | 72px | Numerical value |
| Date | 72px | `DD Mon` format |

Clicking any row opens the Build Inspector. The entire row is the clickable target — not a small button inside the row.

Rows alternate very slightly in background shade for readability at density. Selected / hovered rows highlight with the `--border-hover` colour on the left border.

### Step 7.3 — Design the Build Inspector

The Build Inspector is a modal panel that slides over the leaderboard. On desktop it takes up 60% of the screen width (720px at 1200px viewport). The leaderboard remains visible behind a dim overlay.

**Section A — Run Identity (top of panel):**
- Player name (large, `--text-title`)
- Class icon + name + mode badge (inline)
- Floor reached or bosses killed (very large number, `--text-display`)
- Date, duration, score (secondary row)
- Build archetype label (coloured pill)

**Section B — Build Composition (middle of panel):**
- Active keystone: a full-size card with rarity styling, prominent, centre of attention
- Relics: a 2-column grid of compact relic cards with rarity badges
- Upgrades: a grouped list sorted by category. Each entry shows: rarity colour line, name, stack count. Categories are separated by faint dividers and labelled with their category name.
- Build Fingerprint: a horizontal bar chart showing upgrade distribution across categories. Eight bars, one per category. Each bar shows the percentage of total upgrades that came from that category. Pure CSS, no chart library.

**Section C — Combat Statistics (bottom of panel):**
A 2-column grid of stat rows using the `StatRow` component:

- Final DPS
- Final HPS
- Total Damage
- Total Healing
- Highest Hit
- Total Kills
- Bosses Killed
- Run Duration

**Navigation inside the Inspector:**
- A close button (top-right, always visible)
- Previous run / Next run arrow buttons if viewing from a list context
- A "Copy Build" button that copies a text summary of the build to the clipboard

### Step 7.4 — Define the Build Fingerprint

The fingerprint is a read-only visualisation of how a build is distributed across upgrade categories. It is the same visualisation used in the right HUD rail during a run, keeping the language consistent.

Eight categories: Damage, Critical, Lifesteal, Defense, Poison, Burn, Lightning, Speed.

For each category: count how many upgrades the player holds (total stacks) that belong to it. Divide by the total upgrade count. The result is the percentage for that category's bar.

Bars are full-width of their container. The bar length is the percentage value. The bar colour is the category's accent colour from the token system. The label is the category name. The value is the percentage.

No animations on the fingerprint. It is a static snapshot of a completed run.

### Step 7.5 — Design the Filter and Sort System

Three controls, left to right:

1. **Mode** — `All Modes` (default) / one option per mode in the registry
2. **Class** — `All Classes` (default) / one option per class
3. **Sort by** — `Floor (High to Low)` / `Score (High to Low)` / `Date (Most Recent)` / `DPS (High to Low)`

Changing any filter or sort immediately re-renders the list. No submit button.

Filters and sort are remembered in `localStorage` across sessions so the player does not have to re-select their preferences every visit.

**Phase 7 is complete when:**
- `RunResultDTO` schema additions are documented
- Leaderboard list view is fully specced (columns, widths, interactions)
- Build Inspector is fully specced (all three sections)
- Build Fingerprint calculation is defined
- Filter and sort system is defined

---

## 10. Phase 8 — Information Architecture Audit

**Goal:** Every piece of information in the game earns its screen real estate. Nothing exists because it was easy to add. Nothing is hidden that the player needs frequently.

**Inputs:** Everything produced in Phases 1–7.  
**Outputs:** Information tier assignments for every data point. A list of elements to relocate or remove. Revised screen hierarchy.

### Step 8.1 — Catalogue Every Data Point

Create a spreadsheet. One row per data point currently displayed anywhere in the game. Columns:

- Data point name
- Where it currently appears
- How many times a player needs it during a typical run
- Current discoverability (how many actions required to see it: 0 = always visible, 1 = one click, 2 = two clicks)
- Pain level if it is missing or hard to find (1 = inconvenient, 5 = run-breaking)

### Step 8.2 — Assign Every Data Point to a Tier

After the catalogue is complete, assign each item:

**Tier 1 — Always Visible (maximum 8 items):**
Must be visible at all times during combat without any interaction. If a candidate does not make the top 8 by importance, it drops to Tier 2.

The 8 Tier 1 items: Current floor, Player HP, Enemy HP, Gold, Active class, Keystone name, Relic count, Build archetype.

**Tier 2 — One Action Away:**
Visible in persistent panels that are always open on desktop, or one tap away on mobile. The player should never have to hunt for these.

Items: XP bar and level, Speed controls, Enemy name and status effects, Upgrade category breakdown, Full relic list, Floor modifier name and effect.

**Tier 3 — Deliberate Navigation:**
Requires navigating to a dedicated screen or opening a modal. Accessed intentionally, not frequently.

Items: Full career statistics, All-time personal bests, Leaderboard, Full upgrade descriptions, Relic lore text, Achievement progress, Settings.

### Step 8.3 — Resolve Conflicts

Some items currently exist in the wrong tier. For each conflict:

- Document what tier it is currently in
- Document what tier it should be in
- Define the action required to move it (relocate to a panel, add to HUD, remove from always-visible)

### Step 8.4 — Redesign the HomeScreen Information Hierarchy

The current HomeScene uses a four-tab system (Play / Ranks / Profile / Settings). Tabs imply equal weight. Play is accessed 50× more than Settings.

**New structure:**
- Mode cards are the primary content — always visible, no tab required to see them
- Leaderboard, Profile, and Settings become items in the persistent nav rail, not tabs
- The hub screen has one job: show modes and permanent upgrades. Everything else navigates away.

**Remove the expand/collapse drawer for permanent upgrades.** On desktop, permanent upgrades are visible inline without any toggle. The drawer was a workaround for the 480px canvas width. It is not needed at 1440px.

### Step 8.5 — Audit Overlays for Necessity

For each overlay scene (UpgradeScene, RelicScene, MerchantScene):

- Does it need to be full-screen?
- Can the combat arena remain visible in the background?
- Is the pause-the-game behaviour actually correct, or is it a legacy of Phaser scene management?

**Decision:** On desktop, upgrade and relic selection are slide-in panels, not full-screen takeovers. The arena is visible in the background at reduced opacity. This reduces the sense of interruption and helps the player contextualise their build choice against the enemy they just defeated.

**Phase 8 is complete when:**
- Every data point is catalogued and tier-assigned
- All conflicts are resolved
- HomeScreen hierarchy is redesigned
- Overlay necessity is audited
- A complete "what to remove" and "what to relocate" list exists

---

## 11. Phase 9 — Component Library

**Goal:** No UI pattern is designed twice. Every interactive element comes from the library. The library is the single source of truth for how things look and behave.

**Inputs:** All decisions from Phases 4–8 (tokens, rarity, type, IA).  
**Outputs:** Component spec document. A living HTML specimen page showing every component in every state.

### Step 9.1 — Inventory Existing Patterns

Before defining new components, list every distinct UI pattern currently built in Phaser code. This is the starting inventory.

| Pattern | Where used | Priority |
|---|---|---|
| Mode card | HomeScene | High |
| Upgrade card | UpgradeScene | High |
| Relic card | RelicScene | High |
| HP bar | GameScene HUD | High |
| Progress bar (XP) | GameScene HUD | High |
| Text button | All scenes | High |
| Stat row (label + value) | StatsPanel, StatsScene | High |
| Tab bar | HomeScene | Medium |
| Section label | All scenes | Medium |
| Rarity badge | UpgradeScene, RelicScene | High |
| Scroll container | ClassScene, StatsScene | Medium |
| Overlay background | All overlays | High |
| Gold counter chip | GameScene | Medium |
| Status pip (poison, burn) | GameScene | Low |
| Keyboard hint row | GameScene | Low |

### Step 9.2 — Define the Core Components (Priority Order)

**1. Panel**
The background container for all card and section content. Parameters: layer (1–5), padding, border-radius, optional border variant (default / active / danger / success). All surfaces use this component — no direct background-colour assignments anywhere.

**2. Button**
Four variants:
- `primary` — solid arcane background, used for main CTAs (Play, Start Run)
- `secondary` — outlined, used for secondary actions (Back, View Details)
- `ghost` — no background, text only, used for tertiary actions
- `danger` — red variant, used for destructive actions (Reset Save)

Every button has all five interactive states (from Phase 4).

**3. Card**
A Panel with a structured content slot system: top accent bar (rarity colour), header zone, content zone, footer zone. Used for upgrade cards, relic cards, mode cards, and class cards.

**4. Badge**
Small inline labels. Variants: rarity (with rarity colour), category, status (active/inactive), count. Three sizes: full, medium, micro.

**5. ProgressBar**
One component used everywhere: HP bars, XP bar, upgrade category bars, Build Fingerprint bars. Parameters: value (0–1), colour token, height, label (optional), animated transitions (on/off).

**6. StatRow**
A two-column row: label on the left (muted text), value on the right (coloured by context). Used in StatsPanel, Build Inspector, Game Over summary, and the right HUD rail.

**7. Tooltip**
Appears on hover over any truncated text or badge. Contains: title (body weight), body (caption weight), optional rarity badge. Positioned intelligently to stay within viewport bounds. Delay: 400ms before appearing, 0ms to disappear.

**8. Modal**
The base overlay structure. Parameters: width (compact / standard / wide / fullscreen), whether background is scrollable behind it, whether clicking outside closes it, whether ESC closes it. All screen-covering overlays (UpgradeModal, RelicModal, BuildInspector, etc.) use this component as their base.

**9. ScrollArea**
A container with a custom scrollbar that matches the visual identity. Used in ClassSelectScreen, StatsScreen, BuildInspector, and anywhere content may overflow. The native browser scrollbar is hidden; a styled thin scrollbar is shown instead.

**10. Tab**
Used in the right HUD rail to switch between Build / Stats views during combat. Two-state: active (coloured) and inactive (muted). The tab underline uses `--border-active`.

### Step 9.3 — Define the Phaser ↔ HTML Bridge Components

Some components live inside the Phaser canvas. They must have defined rules for how they integrate.

**FloatingText (Phaser):** Damage numbers, heal numbers, gold gain. Stays in Phaser. Uses the Phaser colour bridge (from Phase 4) to read token colours.

**BossAnnouncement (Phaser):** The boss encounter card animation. Stays in Phaser. Short-lived, canvas-only.

**FloorClearAnimation (Phaser):** The brief "FLOOR CLEARED" animation. Stays in Phaser. All text content communicated via bus to HTML for the game log.

**CombatHUD (HTML):** Everything else in the combat screen. Lives in HTML, overlaid on the canvas via `#hud-root`. Uses RunStateStore for data.

### Step 9.4 — Write the Component Specimen Page

Create `/design/components.html` — a living document that renders every component in every state. This file:

- Is not part of the game build
- Imports `tokens.css` and all component CSS files
- Shows every component at every size, in every state, on the correct background layer
- Is updated whenever a component is added or changed
- Is the visual reference when implementing any screen

### Step 9.5 — Write the Component Usage Rules

For each component, write a usage rule that prevents future inconsistency. Example format:

> **Panel** — Always use `Panel` for any content background. Never assign a background colour directly. Never use `--bg-base` inside a Panel — it is only used for the app shell.

> **Button (primary)** — Used for one CTA per screen maximum. If two primary buttons exist on the same screen, one of them should be `secondary`.

> **StatRow** — Label column is always left-aligned in `--text-label` style. Value column is always right-aligned in the appropriate stat colour. Never centre-align either column.

**Phase 9 is complete when:**
- All 10 core components are fully specced
- The Phaser bridge components are defined
- The specimen page exists and renders all components correctly
- Usage rules are written for every component

---

## 12. Phase 10 — Pre-Art Foundation

**Goal:** When sprites, character art, VFX, and audio arrive, they slot into a system that was designed to receive them. No structural changes are required. The UI foundation is complete enough that art enhances it rather than requiring it to function.

**Inputs:** All previous phases.  
**Outputs:** Complete `tokens.css`. Updated `index.html`. Final specimen page. Integration checklist.

### Step 10.1 — Define Art Integration Zones

Identify every location in the UI where art will eventually live. Mark each as a placeholder zone with explicit dimensions and an `art-placeholder` CSS class.

| Zone | Location | Dimensions | Art type |
|---|---|---|---|
| Class portrait | ClassSelectScreen card, 60×60px region | 60×60px | Class illustration |
| Class portrait (large) | Profile / Game Over | 120×120px | Class illustration |
| Enemy sprite | GameScene arena, right side | 180×220px | Enemy art |
| Player sprite | GameScene arena, left side | 120×160px | Player animation |
| Relic icon | Relic cards, HUD relic list | 32×32px | Icon illustration |
| Keystone emblem | Keystone card, HUD rail | 48×48px | Emblem illustration |
| Mode card illustration | HomeScreen mode cards | 60×60px | Mode illustration |
| Floor background | Arena background | Full canvas | Environment art |

Each placeholder zone has a default state: a geometric shape in the entity's primary colour with an initial letter or category symbol. When art arrives, it replaces the placeholder without any layout changes.

### Step 10.2 — Complete the Token System

Add the remaining token categories not covered in Phases 4 and 6:

**Spacing scale (4px base):**

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Micro spacing, icon gaps |
| `--space-2` | 8px | Tight spacing, badge padding |
| `--space-3` | 12px | Default inner padding |
| `--space-4` | 16px | Standard component padding |
| `--space-5` | 24px | Section spacing |
| `--space-6` | 32px | Large section gaps |
| `--space-7` | 48px | Screen-level spacing |
| `--space-8` | 64px | Major layout gaps |

**Z-index scale:**

| Token | Value | Use |
|---|---|---|
| `--z-base` | 1 | Normal content flow |
| `--z-raised` | 10 | Cards, hover effects |
| `--z-hud` | 20 | HUD overlay during combat |
| `--z-panel` | 30 | Slide-in panels |
| `--z-modal` | 40 | Full-screen modals |
| `--z-toast` | 50 | Notifications, always on top |

**Border radius scale:**

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 2px | Micro elements (progress bar fill, tags) |
| `--radius-md` | 4px | Buttons, badges, small cards |
| `--radius-lg` | 8px | Panels, standard cards |
| `--radius-xl` | 12px | Large cards, modals |
| `--radius-full` | 9999px | Pills, circular badges |

**Transition durations:**

| Token | Value | Use |
|---|---|---|
| `--transition-fast` | 120ms | Hover states, button press |
| `--transition-normal` | 200ms | Panel entrances, fade-ins |
| `--transition-slow` | 350ms | Modal opens, screen transitions |

### Step 10.3 — Define the Animation Language

Before VFX arrive, define the vocabulary of motion. All motion respects `prefers-reduced-motion: reduce`.

| Motion type | Duration | Easing | Applied to |
|---|---|---|---|
| Element enters view | `--transition-normal` | `ease-out` | Modals, panels, cards |
| Element exits view | `--transition-fast` | `ease-in` | Modals closing, cards disappearing |
| Hover state | `--transition-fast` | `ease` | All interactive elements |
| Number changes | 60ms | — | `scale: 1 → 1.08 → 1` on HP/gold counters |
| Slide-in panel | `--transition-normal` | `cubic-bezier(0.2, 0, 0, 1)` | HUD drawers, side panels |
| Screen transition | `--transition-slow` | `ease-in-out` | Route changes |

No bouncing. No spinning. No long animations. This is a data-heavy game — motion should inform and confirm, not entertain.

### Step 10.4 — Write the Integration Checklist

A short checklist for any new UI element added to the project:

```
UI Element Integration Checklist

Before adding a new UI element to the codebase, confirm:

[ ] Uses only design tokens from tokens.css — no hardcoded hex values or pixel sizes
[ ] Uses the correct component from the component library — no custom background/border definitions
[ ] All five interactive states are implemented: default, hover, active, focused, disabled
[ ] Responsive at all three breakpoints: wide, medium, compact
[ ] Art placeholder state defined if the element will contain future art
[ ] Text content has been assigned the correct type token from the type scale
[ ] Any long strings (20+ chars) have a truncation rule and tooltip
[ ] Animations follow the animation language defined in tokens.css
[ ] `prefers-reduced-motion` is respected for all transitions
[ ] Component behaviour at each breakpoint is documented
```

**Phase 10 is complete when:**
- All art placeholder zones are defined and marked in the spec
- The spacing, z-index, radius, and transition tokens are in `tokens.css`
- The animation language is documented
- The integration checklist is written
- The specimen page is updated with all final components and tokens

---

## 13. Migration Plan

This section describes the exact order in which Phaser scenes are migrated to HTML. Each step leaves the game in a fully playable state. No step breaks the build.

### Step M1 — Create the Bridge (No Visible Changes)

Create `GameEventBus.ts` and `RunStateStore.ts`. Export them. Neither file is imported by anything yet. This is purely additive. The game continues to work exactly as before.

Verify: build passes, game plays normally.

### Step M2 — Create the HTML Shell (No Visible Changes)

Update `index.html` to add `#ui-layer`, `#screen-root`, `#modal-root`, `#hud-root`, `#toast-root`, and `#canvas-mount`. Move the existing Phaser canvas mount point into `#canvas-mount`.

Create `tokens.css` with all variables from Phases 4 and 6. Import it in `index.html`.

Create the `Router` class. Wire it to `#screen-root`. Create one placeholder screen for each route that renders a `<div>` with the screen name. The router defaults to the `home` route.

At this stage, the HTML layer and the Phaser canvas both exist but do not interact. The Phaser game runs at full size in `#canvas-mount`. The HTML layer sits on top but shows nothing visible (all placeholder screens are transparent or hidden).

Verify: build passes, game plays normally.

### Step M3 — Wire GameScene to the Bridge

In `GameScene`, import `bus` and `runState`. Add calls to `runState.update()` at the end of every combat resolution method. Add calls to `bus.emit()` for discrete events (floor cleared, boss killed, upgrade available, etc.).

Do not change the Phaser HUD yet. The Phaser HUD still renders. The bridge now carries data, but nothing in HTML reads it yet.

Verify: build passes, game plays normally, bridge data is correct (add temporary `console.log` to verify).

### Step M4 — Build the CombatHUD (HTML)

Create `CombatHUD.ts`. It subscribes to `RunStateStore` and updates the DOM elements in `#hud-root`.

Position `#hud-root` over `#canvas-mount` using `position: absolute; inset: 0`. The two HP bars, gold counter, floor label, XP bar, and speed controls all exist in HTML, absolutely positioned relative to the HUD root.

The Phaser HUD is still rendering in parallel as a safety net. Both are visible simultaneously — the HTML version on top. Compare them to verify the HTML version is correct.

Verify: build passes, game plays normally, HTML HUD matches Phaser HUD.

### Step M5 — Remove the Phaser HUD

Delete `createHUD()`, `buildBottomBar()`, `buildHpPanels()`, `buildModifierStrip()`, and `createSpeedButtons()` from `GameScene`. Remove all references to the deleted HUD properties.

The HTML CombatHUD is now the only HUD.

Verify: build passes, game plays normally, HTML HUD is correct, no Phaser HUD elements visible.

### Step M6 — Migrate HomeScene to HTML

Create `screens/HomeScreen.ts`. Implement the full HomeScreen design from Phase 2 in HTML. Read data from `LocalProfileService`, `LocalRunHistoryService`, and `metaService` directly — no Phaser or bus needed.

Wire the `Router` to show `HomeScreen` at the `home` route. Wire mode card buttons to call `Router.navigate('class-select', { modeId })`.

Set `#canvas-mount` to `display: none` when the router is on the `home` route.

Delete `HomeScene.ts` from the Phaser scene registry.

Verify: build passes, hub screen renders in HTML, mode cards are clickable, no Phaser HomeScene artifacts.

### Step M7 — Migrate ClassScene to HTML

Create `screens/ClassSelectScreen.ts`. Implement the class selection grid in HTML.

Wire the back button to `Router.back()`. Wire class card selection to call `startRun({ classId, modeId })`.

Create `bridge/startRun.ts`. This function: sets `RunConfig`, calls `Router.navigate('combat')`, makes `#canvas-mount` visible, and calls `phaserGame.scene.start('GameScene')`. Phaser is initialised lazily here if it has not been already.

Delete `ClassScene.ts`.

Verify: build passes, class selection works, run starts correctly from HTML.

### Step M8 — Migrate UpgradeScene to an HTML Modal

Create `modals/UpgradeModal.ts`. Implement the upgrade card selection in HTML. Mount it in `#modal-root`.

`UpgradeModal` listens to `bus.on('upgrade:available')` to open. When a card is selected, it emits `bus.emit({ type: 'upgrade:selected', payload: { upgradeId } })` and closes.

In `GameScene`, replace the `launchUpgradeScreen()` method to emit `upgrade:available` instead of calling `this.scene.launch('UpgradeScene')`. Listen to `upgrade:selected` on the bus to apply the upgrade and resume.

Delete `UpgradeScene.ts`.

Verify: build passes, upgrade selection works via HTML modal.

### Step M9 — Migrate RelicScene and MerchantScene

Follow the same pattern as Step M8. Both become HTML modals communicating through the bus.

Delete `RelicScene.ts` and `MerchantScene.ts`.

Verify: build passes, relic selection and merchant both work.

### Step M10 — Migrate the Game Over Screen

Create `modals/GameOverModal.ts`. Implement the full game over summary in HTML.

`GameOverModal` listens to `bus.on('run:ended')`. When it opens, it renders the complete run summary including the build fingerprint (using the `BuildInspectorModal` component).

After displaying, offer two buttons: "Play Again" (calls `startRun` with same config) and "Return to Hub" (calls `Router.navigate('home')`).

In `GameScene.onPlayerDead()`, emit `run:ended` to the bus. Remove `showGameOverOverlay()`.

Verify: build passes, game over shows correctly, navigation works.

### Step M11 — Migrate StatsScene and NameEntryScene

Create `screens/StatsScreen.ts` and `screens/NameEntryScreen.ts`. Both read from `ServiceLocator` services directly.

Wire the nav rail links to navigate to these screens.

Delete `StatsScene.ts` and `NameEntryScene.ts`.

### Step M12 — Build the Leaderboard Screen

Create `screens/LeaderboardScreen.ts`. Implement the list view from Phase 7.

Create `modals/BuildInspectorModal.ts`. Wire it to open from leaderboard row clicks.

The `BuildInspectorModal` component is reused inside `GameOverModal` to show the completed run. One component, two contexts.

### Step M13 — Apply Visual Identity

Apply all tokens from `tokens.css` across every HTML screen and component. Remove all hardcoded colours and sizes.

Apply rarity visual styles across all card components.

### Step M14 — Apply Responsive Breakpoints

Add `@container` queries and media queries for the `medium` and `compact` breakpoints. Test every screen at 768px and 390px. Verify nothing overflows or clips.

---

## 14. Final File Structure

After all migrations are complete, the project structure looks like this:

```
src/
│
├── main.ts                      ← app entry point, Router init, lazy Phaser init
├── RunConfig.ts                 ← unchanged
│
├── bridge/
│   ├── GameEventBus.ts          ← typed event emitter
│   ├── RunStateStore.ts         ← observable run state
│   └── startRun.ts              ← single entry point to begin a run
│
├── styles/
│   ├── tokens.css               ← ALL design tokens (colour, space, type, etc.)
│   ├── reset.css                ← minimal browser reset
│   ├── layout.css               ← shell, router, canvas mount positioning
│   └── components/
│       ├── button.css
│       ├── panel.css
│       ├── card.css
│       ├── badge.css
│       ├── progress-bar.css
│       ├── stat-row.css
│       ├── tooltip.css
│       ├── modal.css
│       ├── scroll-area.css
│       └── hud.css
│
├── screens/                     ← HTML screens (replace Phaser menu scenes)
│   ├── HomeScreen.ts
│   ├── ClassSelectScreen.ts
│   ├── StatsScreen.ts
│   ├── LeaderboardScreen.ts
│   ├── SettingsScreen.ts
│   └── NameEntryScreen.ts
│
├── modals/                      ← HTML modals (replace Phaser overlay scenes)
│   ├── UpgradeModal.ts
│   ├── RelicModal.ts
│   ├── MerchantModal.ts
│   ├── GameOverModal.ts
│   └── BuildInspectorModal.ts
│
├── hud/                         ← HTML HUD overlaid on combat canvas
│   ├── CombatHUD.ts
│   ├── HudLeft.ts
│   ├── HudRight.ts
│   └── HudModifierStrip.ts
│
├── components/                  ← reusable HTML UI components
│   ├── Button.ts
│   ├── Panel.ts
│   ├── Card.ts
│   ├── Badge.ts
│   ├── ProgressBar.ts
│   ├── StatRow.ts
│   ├── Tooltip.ts
│   ├── RarityBadge.ts
│   ├── ScrollArea.ts
│   └── BuildFingerprint.ts
│
├── router/
│   └── Router.ts                ← client-side screen router
│
├── scenes/                      ← ONLY Phaser scenes remain here
│   ├── BootScene.ts             ← unchanged
│   └── GameScene.ts             ← trimmed to combat simulation only
│
├── combat/                      ← unchanged
├── data/                        ← unchanged (+ RunResultDTO schema updates)
├── entities/                    ← unchanged
├── floors/                      ← unchanged
├── modes/                       ← unchanged
├── services/                    ← unchanged
├── meta/                        ← unchanged
└── ui/
    ├── StatsPanel.ts            ← remains in Phaser (Tab overlay)
    ├── BuildPanel.ts            ← remains in Phaser (B key overlay)
    └── XPManager.ts             ← unchanged
│
design/                          ← NOT part of game build
├── type-specimen.html           ← typography reference
├── components.html              ← component library specimen
└── wireframes/                  ← screen wireframes (any format)
```

**Deleted after migration:**

| File | Replaced by |
|---|---|
| `src/scenes/HomeScene.ts` | `src/screens/HomeScreen.ts` |
| `src/scenes/ClassScene.ts` | `src/screens/ClassSelectScreen.ts` |
| `src/scenes/StatsScene.ts` | `src/screens/StatsScreen.ts` |
| `src/scenes/NameEntryScene.ts` | `src/screens/NameEntryScreen.ts` |
| `src/scenes/UpgradeScene.ts` | `src/modals/UpgradeModal.ts` |
| `src/scenes/RelicScene.ts` | `src/modals/RelicModal.ts` |
| `src/scenes/MerchantScene.ts` | `src/modals/MerchantModal.ts` |
| `src/scenes/MetaScene.ts` | Already dead — fully removed |

---

## 15. Implementation Order

The following table shows every step in execution order with its dependencies. No step begins until its dependencies are complete.

| # | Step | Depends on | Deliverable | Breaks build? |
|---|---|---|---|---|
| 1 | Write Phase 1 audit | Nothing | Audit document | No |
| 2 | Define architecture decision | Step 1 | Decision record | No |
| 3 | Design wireframes (Phase 2) | Steps 1, 2 | Wireframes for all screens | No |
| 4 | Design mobile spec (Phase 3) | Step 3 | Component breakpoint spec | No |
| 5 | Create `tokens.css` (Phase 4) | Nothing | Token file | No |
| 6 | Define rarity system (Phase 5) | Step 5 | Rarity token additions | No |
| 7 | Define type scale (Phase 6) | Step 5 | Type token additions | No |
| 8 | Design IA tier assignments (Phase 8) | Step 3 | IA document | No |
| 9 | Spec component library (Phase 9) | Steps 5, 6, 7, 8 | Component spec document | No |
| 10 | Create specimen pages (Phase 10) | Step 9 | `design/` HTML files | No |
| 11 | **M1** — Create bridge files | Step 2 | `GameEventBus`, `RunStateStore` | No |
| 12 | **M2** — Update HTML shell | Step 5 | Updated `index.html`, CSS layout | No |
| 13 | **M3** — Wire `GameScene` to bridge | Steps 11, 12 | Events + state sync in GameScene | No |
| 14 | **M4** — Build `CombatHUD` (HTML) | Steps 9, 13 | CombatHUD + HUD components | No |
| 15 | **M5** — Remove Phaser HUD | Step 14 | Cleaned `GameScene` | No |
| 16 | **M6** — Migrate `HomeScene` | Steps 9, 12 | `HomeScreen.ts` | No |
| 17 | **M7** — Migrate `ClassScene` | Steps 9, 16 | `ClassSelectScreen.ts` | No |
| 18 | **M8** — Migrate `UpgradeScene` | Steps 9, 13 | `UpgradeModal.ts` | No |
| 19 | **M9** — Migrate `RelicScene`, `MerchantScene` | Step 18 | Two HTML modals | No |
| 20 | **M10** — Migrate Game Over | Steps 9, 13 | `GameOverModal.ts` | No |
| 21 | **M11** — Migrate `StatsScene`, `NameEntryScene` | Step 9 | Two HTML screens | No |
| 22 | **M12** — Build Leaderboard + Build Inspector | Steps 9, 21 | Two new screens/modals | No |
| 23 | **M13** — Apply visual identity | Step 22 | All tokens applied | No |
| 24 | **M14** — Responsive breakpoints | Step 23 | All screens verified at 3 breakpoints | No |

---

## 16. Rules & Constraints

These rules apply to every decision and every line of code written during this milestone.

### What This Milestone Is

- A complete visual and architectural overhaul
- A transition from a Phaser-only UI to a hybrid HTML/Phaser architecture
- A professional visual identity built on the provided colour palette
- A responsive layout system that works at 390px and 1920px
- A component library that prevents future inconsistency
- A foundation that makes adding art assets, VFX, and sound a smooth process

### What This Milestone Is Not

- A new combat system
- New enemies, classes, relics, or upgrades
- Changes to game balance, upgrade frequency, or relic acquisition
- New game modes
- Any feature that changes how the game is played

If a change to game content is proposed during this milestone, it is deferred to the next milestone without discussion.

### The Non-Negotiable Rules

**1. Every colour comes from `tokens.css`.** No hardcoded hex values anywhere in the codebase after this milestone. If a colour is needed and it is not in the token file, add it to the token file with a documented semantic role — do not inline it.

**2. Every font size comes from the type scale.** No hardcoded pixel sizes for typography. If a size is needed and it is not in the scale, evaluate whether the scale needs a new level or whether the existing levels are being used incorrectly.

**3. The bridge is the only interface between Phaser and HTML.** `GameScene` does not call HTML functions. HTML components do not call Phaser methods. All communication goes through `GameEventBus` and `RunStateStore`.

**4. Every step leaves the game playable.** No migration step is considered complete until the build passes and the game can be started, played, and completed from beginning to end without errors.

**5. No framework.** The HTML layer uses vanilla TypeScript and CSS. No React, Vue, Svelte, or any other component framework. The game's existing stack is TypeScript + Vite. Adding a framework introduces tooling complexity, bundle size, and learning curve without meaningful benefit at this scale.

**6. Design before code.** Phases 1–10 are planning phases. Every screen has a wireframe. Every component has a spec. Every token has a documented role. Code is written only after the design decision is made — not as a way of exploring the design.

**7. One component, never twice.** If a UI pattern appears twice in the game, it uses the same component. Duplicating layout code is not allowed. If two contexts need slightly different behaviour, that is a variant of one component — not two separate implementations.

**8. Mobile is prepared, not implemented.** Phase 3 defines the mobile architecture. Mobile CSS (`compact` breakpoint) is written during the responsive breakpoint pass in Step M14. Mobile touch interactions (swipe, pinch, long-press) are not implemented in this milestone.

---

*End of Specification*

*This document is the single source of truth for the UI Overhaul milestone. All implementation decisions must be traceable to a section of this document. If a decision is not covered here, update this document before writing code.*
