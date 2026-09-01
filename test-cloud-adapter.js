// test-cloud-adapter.js - Cloud Database Integration & Offline Resilience Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage and window
if (typeof window === 'undefined') {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  };
}

const OfflineSyncCache = require('./src/offline-sync-cache.js');
const CloudGuestAdapter = require('./src/cloud-guest-adapter.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTests() {
  console.log('\n🧪 Testing Cloud Architecture, Supabase Adapter & Offline Resilience...\n');

  // 1. Verify SQL Schema files exist and contain required tables & RLS
  test('PostgreSQL schema.sql exists and contains all required tables and RPCs', () => {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.events'), 'Must define events table');
    assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.tables'), 'Must define tables table');
    assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.guests'), 'Must define guests table');
    assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.checkin_logs'), 'Must define checkin_logs table');
    assert(schemaSql.includes('CREATE TABLE IF NOT EXISTS public.album_photos'), 'Must define album_photos table');
    assert(schemaSql.includes('submit_guest_rsvp'), 'Must define atomic submit_guest_rsvp RPC');
    assert(schemaSql.includes('process_door_checkin'), 'Must define atomic process_door_checkin RPC');
  });

  test('rls-policies.sql defines Row Level Security policies', () => {
    const rlsSql = fs.readFileSync(path.join(__dirname, 'database', 'rls-policies.sql'), 'utf8');
    assert(rlsSql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
    assert(rlsSql.includes('Public read active events'), 'Must include public read policy for events');
    assert(rlsSql.includes('Public read approved album photos'), 'Must include album photo policy');
  });

  // 2. Test OfflineSyncCache
  test('OfflineSyncCache saves and retrieves cached event snapshots', () => {
    const cache = new OfflineSyncCache();
    const eventData = { id: 'evt_123', slug: 'boda-test', title: 'Boda de Gala' };
    
    assert(cache.cacheEventSnapshot('boda-test', eventData), 'Should cache snapshot');
    const cached = cache.getCachedEventSnapshot('boda-test');
    assert.deepStrictEqual(cached, eventData, 'Cached snapshot must match original');
  });

  test('OfflineSyncCache manages offline mutations queue', () => {
    const cache = new OfflineSyncCache();
    cache.clear();
    assert.strictEqual(cache.getPending().length, 0, 'Queue should start empty');

    const item = cache.enqueue('CHECKIN', { guestId: 'g_1', passes: 2 });
    assert(item && item.id, 'Item should be enqueued with ID');
    assert.strictEqual(cache.getPending().length, 1, 'Queue should have 1 item');

    cache.markSynced(item.id);
    assert.strictEqual(cache.getPending().length, 0, 'Queue should be empty after sync');
  });

  // 3. Test CloudGuestAdapter with Mock Supabase Client
  const mockDb = {
    events: [{ id: 'evt_boda_1', slug: 'boda-sofia-mateo', title: 'Boda Sofía & Mateo', is_active: true }],
    guests: [{ id: 'g_test_1', event_id: 'evt_boda_1', name: 'Familia Morales', passes: 3, confirmed_passes: 0, folio: 'M01-MORALES-3P', status: 'SENT' }]
  };

  const mockSupabaseClient = {
    from(table) {
      return {
        select(fields) {
          return {
            eq(col, val) {
              return {
                eq(col2, val2) {
                  return {
                    single: async () => {
                      const found = mockDb[table]?.find(r => r[col] === val && r[col2] === val2);
                      return { data: found || null, error: found ? null : new Error('Not found') };
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    async rpc(name, params) {
      if (name === 'submit_guest_rsvp') {
        const guest = mockDb.guests.find(g => g.id === params.p_guest_id);
        if (!guest) return { data: null, error: new Error('Guest not found') };
        guest.status = params.p_confirmed ? 'CONFIRMED' : 'DECLINED';
        guest.confirmed_passes = params.p_confirmed ? (params.p_confirmed_passes || guest.passes) : 0;
        guest.diet = params.p_diet;
        guest.notes = params.p_notes;
        return { data: { success: true, guest }, error: null };
      }
      if (name === 'process_door_checkin') {
        const guest = mockDb.guests.find(g => g.folio === params.p_query_or_folio);
        if (!guest) return { data: null, error: new Error('Guest not found') };
        guest.status = 'CHECKED_IN';
        guest.admitted_passes = params.p_admitted_passes || guest.passes;
        return { data: { success: true, guest }, error: null };
      }
      return { data: null, error: new Error('Unknown RPC') };
    }
  };

  const adapter = new CloudGuestAdapter({ client: mockSupabaseClient });

  await (async () => {
    const loaded = await adapter.loadEvent('boda-sofia-mateo');
    test('CloudGuestAdapter successfully loads event by slug via Supabase client', () => {
      assert(loaded && loaded.title === 'Boda Sofía & Mateo', 'Event title must match');
    });
  })();

  await (async () => {
    let notified = false;
    adapter.onUpdate((type, payload) => {
      if (type === 'RSVP_UPDATED') notified = true;
    });

    const res = await adapter.recordRsvpResponse('g_test_1', {
      confirmed: true,
      confirmedPasses: 3,
      diet: 'Gluten-Free',
      notes: 'Encantados de asistir'
    });

    test('CloudGuestAdapter executes atomic RSVP and notifies real-time listeners', () => {
      assert(res.success, 'RSVP must succeed');
      assert.strictEqual(res.guest.status, 'CONFIRMED', 'Guest status must be CONFIRMED');
      assert.strictEqual(res.guest.diet, 'Gluten-Free', 'Diet must match');
      assert(notified, 'Listener must be triggered');
    });
  })();

  await (async () => {
    const res = await adapter.checkInGuest('evt_boda_1', 'M01-MORALES-3P', 3);
    test('CloudGuestAdapter executes door checkin by folio', () => {
      assert(res.success, 'Door check-in must succeed');
      assert.strictEqual(res.guest.status, 'CHECKED_IN', 'Status must be CHECKED_IN');
      assert.strictEqual(res.guest.admitted_passes, 3, 'Admitted passes must be 3');
    });
  })();

  // 4. Test Offline Fallback Replay
  await (async () => {
    const offlineAdapter = new CloudGuestAdapter({ client: null });
    await offlineAdapter.checkInGuest('evt_offline', 'M02-GARCIA-2P', 2);
    
    test('Offline checkins are captured in resilience queue when connection drops', () => {
      const pending = offlineAdapter.offlineCache.getPending();
      assert.strictEqual(pending.length, 1, 'Must have 1 pending mutation');
      assert.strictEqual(pending[0].actionType, 'CHECKIN');
    });
  })();

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runAsyncTests();
