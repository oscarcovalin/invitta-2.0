# Capability Map: Invitta Cloud Production Architecture

| Module ID | Responsibility | Depends On |
| :--- | :--- | :--- |
| `cloud-schema-rls` | PostgreSQL Database Schema, Types, and Row Level Security (RLS) policies for multi-event isolation. | — |
| `cloud-data-adapter` | Client-side and server-side data adapter with Supabase/PostgreSQL backend & Offline Cache Fallback. | `cloud-schema-rls` |
| `rsvp-engine-api` | Public RSVP submission, dietary requirements, and atomic seat count updates. | `cloud-data-adapter` |
| `door-scanner-sync` | Real-time WebSockets / Supabase Realtime synchronization for Hostess door scanners and live room capacity. | `cloud-data-adapter` |
| `media-storage-vault` | Cloud Storage bucket integration for guest photo uploads (Collaborative Album) and audio assets. | `cloud-data-adapter` |

**Build Order:** `cloud-schema-rls` ➔ `cloud-data-adapter` ➔ `rsvp-engine-api` & `door-scanner-sync` ➔ `media-storage-vault`
