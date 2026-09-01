# Spec: Invitta 2.0 Ultra-Simple & Pro Seating Organizer UX

## Objective
Transform `organizador-mesas.html` and `seating-module/` into a zero-learning-curve seating command center that delights first-time couples (novios/papás) while delivering power tools for seasoned Wedding Planners, adhering to Addy Osmani's `frontend-ui-engineering` and `spec-driven-development` guidelines.

## User Personas & Core Workflows
1. **First-Time Couple / Non-Tech Host:**
   - Wants a clear, uncluttered view.
   - Understands tables as visual boxes with seats.
   - Needs 1-click magic actions (Auto-seat families, Print waiter sheet, Send WhatsApp).
2. **Professional Wedding Planner / Event Manager:**
   - Needs rapid keyboard/search navigation.
   - Monitors capacity margins, special diets, and VIP flags.
   - Accesses detailed 2D floor plan view and live door-checkin heatmap.

## Gated Capabilities
```text
[TOP BAR: Progress & Capacity Semaphore]
  ├── [Quick Search Bar: Instant guest & table highlighter]
  ├── [Mode Switcher: "📦 Vista Tarjetas Sencillas" (Default) | "🗺️ Vista Plano 2D"]
  └── [Magic Action Buttons: "🪄 Acomodar Familias", "📄 Imprimir Meseros", "💬 Compartir WhatsApp"]

[MAIN VIEWPORT]
  ├── MODE A (Simple Cards): Clean table cards with seats, occupancy counter, drag & drop
  └── MODE B (2D Floor Plan): Spatial layout with Imperial head table, dance floor, round tables
```

## Logic & Algorithms
1. **`autoSeatByFamily(guests, tables)`:**
   - Groups guests by `familyKey` or primary surname.
   - Reserves Table 1 (Imperial) for VIPs, bride & groom, and Court of Honor.
   - Allocates each family unit to the first table with sufficient remaining capacity without fragmenting the family across tables.
2. **`generateWaiterPrintSheet(guests, tables)`:**
   - Produces clean, elegant HTML/PDF ready for printing with:
     - Table Number & Name
     - Guest Names & Passes
     - Special Diets (🌱 Veg, 🌾 Gluten-Free, 👶 Menú Infantil)
     - Total Guests per Table.

## Acceptance Criteria & Success Proof
- [ ] Switching between Simple Card Mode and 2D Floor Plan is instantaneous (0 page reload).
- [ ] Searching a guest highlights their table card with an animated gold glow in < 50ms.
- [ ] 1-Click "Acomodar Familias" seats all unassigned guests while keeping families together.
- [ ] "Imprimir Hoja de Meseros" opens a clean, printer-friendly dialog.
- [ ] 100% test pass rate in `test-seating-ux.js`.
