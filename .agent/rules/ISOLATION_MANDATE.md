---
name: ISOLATION MANDATE
priority: CRITICAL
---

# ⚠️ ABSOLUTE ISOLATION MANDATE ⚠️

The user dictates a STRICT, ZERO-INTERFERENCE policy between legacy systems and new systems.

## The Three Pillars (Domains)
1. **proengtopografia.vercel.app/hub** -> LEGACY A. Must remain INTACT. No database rule changes, no auth changes, no code modifications that share state with new apps.
2. **proeng-topografia-uzg7.vercel.app** -> LEGACY B. Must remain INTACT. Same as above.
3. **ecossistema-pro.vercel.app** -> NEW ECOSYSTEM. This is the ONLY domain where new features, user management, and module integrations happen.

## Database & Backend Separation ("Outro Terreno")
- The new `ecossistema-pro` MUST NOT share the same Firebase Project (Auth/Firestore) as the legacy apps.
- Any development for `ecossistema-pro` requires duplicating infrastructure rather than modifying existing logic that legacy apps depend on.
- **NEVER** modify Google Cloud / Firebase rules on the legacy project to accommodate the new project.

**Failure to follow this mandate will cause critical business interruptions for actively working users.**
