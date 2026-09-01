# Spec: Invitta 2.0 Cloud Production Architecture & Persistence Layer

## Objective
Transition `invitta-2.0-beta` from browser-local persistence (`localStorage`) to a scalable, production-grade cloud backend powered by PostgreSQL / Supabase, enabling real-time multi-device synchronization (bride, wedding planner, hostess, guests), strict multi-tenant event isolation, secure cloud storage for photo memories, and seamless offline-first fallback.

## Tech Stack
- **Database & Backend:** Supabase (PostgreSQL 15+) with Row Level Security (RLS) and Realtime change streams.
- **Client Layer:** JavaScript (ES6+ / CommonJS / Universal browser UMD) with `@supabase/supabase-js`.
- **Storage:** Supabase Storage (S3-compatible bucket) for the Collaborative Memory Capsule (`invitta-album-photos`).
- **Frontend / Hosting:** Vercel / Cloudflare Pages with Edge caching.
- **Testing:** Node.js native assert test suites with mock database harness.

## Commands
```bash
# Test Cloud Database Adapter & Schemas
node test-cloud-adapter.js

# Test End-to-End Cloud Flow
node test-e2e-cloud-sync.js

# Run full project regression suite (159 tests + cloud)
node test-guest-manager.js && node test-audit-fixes.js && node test-e2e-full-lifecycle.js
```

## Project Structure
```text
database/
├── schema.sql                   # DDL for PostgreSQL (events, tables, guests, checkin_logs, album_photos)
├── rls-policies.sql             # Row Level Security policies per role (Host, Planner, Hostess, Public Guest)
└── seed.sql                     # Initial seed fixtures for test wedding & XV events
src/
├── cloud-client.js              # Universal Supabase Client initializer with env resolution
├── cloud-guest-adapter.js       # Cloud repository implementing GuestManager storage interface
└── offline-sync-cache.js        # Local fallback queue & offline synchronization
tasks/
├── CAPABILITY-MAP.md            # Modular capability map
└── SPEC-cloud-architecture.md   # This specification document
```

## Relational Schema Design

### 1. `events` (Tenancy Root)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `slug` (TEXT, UNIQUE, indexed, e.g. `boda-valentina-sebastian`)
- `title` (TEXT, NOT NULL)
- `event_type` (TEXT, e.g. `'boda' | 'xv' | 'corporativo'`)
- `hosts` (TEXT)
- `event_date` (TIMESTAMPTZ)
- `venue` (TEXT)
- `master_pin_hash` (TEXT, hashed PIN)
- `config` (JSONB, containing full design theme, itinerary, music, palettes)
- `created_at` (TIMESTAMPTZ, default `now()`)

### 2. `tables` (Seating Plan)
- `id` (UUID, Primary Key)
- `event_id` (UUID, REFERENCES `events(id)` ON DELETE CASCADE)
- `name` (TEXT, e.g. `'Mesa Imperial'`, `'Mesa 01'`)
- `type` (TEXT, `'imperial' | 'circular' | 'cocktail'`)
- `capacity` (INTEGER, NOT NULL)
- `order_index` (INTEGER, default 0)

### 3. `guests` (Access & Attendance)
- `id` (UUID, Primary Key)
- `event_id` (UUID, REFERENCES `events(id)` ON DELETE CASCADE)
- `table_id` (UUID, REFERENCES `tables(id)` ON DELETE SET NULL)
- `name` (TEXT, NOT NULL)
- `contact_name` (TEXT)
- `passes` (INTEGER, NOT NULL, CHECK `passes > 0`)
- `confirmed_passes` (INTEGER, default 0)
- `admitted_passes` (INTEGER, default 0)
- `folio` (TEXT, NOT NULL, indexed, e.g. `'MIMP-GARZA-3P'`)
- `status` (TEXT, `'DRAFT' | 'SENT' | 'CONFIRMED' | 'DECLINED' | 'CHECKED_IN' | 'EMERGENCY'`)
- `phone` (TEXT)
- `email` (TEXT)
- `diet` (TEXT)
- `notes` (TEXT)
- `is_court` (BOOLEAN, default false)
- `is_vip` (BOOLEAN, default false)
- `is_emergency` (BOOLEAN, default false)
- `sent_at` (TIMESTAMPTZ)
- `responded_at` (TIMESTAMPTZ)
- `checked_in_at` (TIMESTAMPTZ)

### 4. `checkin_logs` (Audit & Access Stream)
- `id` (UUID, Primary Key)
- `event_id` (UUID, REFERENCES `events(id)` ON DELETE CASCADE)
- `guest_id` (UUID, REFERENCES `guests(id)` ON DELETE CASCADE)
- `folio` (TEXT)
- `admitted_passes` (INTEGER)
- `scanned_by` (TEXT, e.g. `'Hostess Puerta Principal'`)
- `created_at` (TIMESTAMPTZ, default `now()`)

### 5. `album_photos` (Collaborative Memory Capsule)
- `id` (UUID, Primary Key)
- `event_id` (UUID, REFERENCES `events(id)` ON DELETE CASCADE)
- `guest_id` (UUID, REFERENCES `guests(id)` ON DELETE SET NULL)
- `author_name` (TEXT)
- `photo_url` (TEXT, NOT NULL)
- `dedication` (TEXT)
- `is_approved` (BOOLEAN, default true)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Row Level Security (RLS) Policies
1. **Public Read by Event Slug:**
   - Any guest can view public event metadata and their assigned invitation record.
2. **Public Guest RSVP Update:**
   - Guests can only mutate their own `status`, `confirmed_passes`, `diet`, `notes`, and `responded_at`.
3. **Hostess Door Scanner Access:**
   - Can query guests by `folio` or `name` and write to `checkin_logs`.
4. **Admin / Wedding Planner Full Control:**
   - Requires valid `master_pin` or authenticated admin session.

## Boundaries
- **Always:** Use parameterized queries via Supabase client (no raw string concatenation).
- **Always:** Keep offline-first cache so Hostess can scan guests even if venue WiFi drops.
- **Ask First:** Deleting events, truncating guest tables, or modifying production schema columns.
- **Never:** Expose service_role admin secrets in client-side HTML or frontend scripts.

## Success Criteria
- [ ] Database schema DDL and RLS policies created in `database/schema.sql` and `database/rls-policies.sql`.
- [ ] `CloudGuestAdapter` seamlessly interchanges with `GuestManager` local state.
- [ ] Multi-device sync: An RSVP on a mobile phone updates the organizer desktop within < 500ms via Supabase Realtime.
- [ ] Offline resilience: Hostess door scanner caches event guest list and syncs offline scans upon reconnecting.
- [ ] 100% automated test pass rate with zero security vulnerabilities.
