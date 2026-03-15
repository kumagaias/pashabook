# Postmortem: Infinite Polling Loop Incident

**Date**: 2026-03-11  
**Severity**: High  
**Status**: Resolved

## Overview

Infinite polling loop in progress screen caused 22,261 API requests in 30 minutes, with peak of 1,027 requests per second.

## Timeline

- **23:04**: User accessed progress screen
- **23:05**: Request storm began (1,027 req/sec)
- **23:30**: Approximately when user closed browser
- **2026-03-12 08:07**: Fixed version deployed

## Root Cause

`pollJobStatus` callback included `book` state in dependencies array:

```typescript
// Problematic code
const pollJobStatus = useCallback(async () => {
  // ... fetch and update book state
  setBook(updatedBook);
}, [book]); // ← book changes → new callback → new interval
```

Each state update created a new callback, which triggered `useEffect` to create a new interval without clearing the old one, resulting in exponential growth of polling intervals.

## Impact

- **Requests**: 22,261 in ~30 minutes
- **Peak rate**: 1,027 requests/second
- **Cost**: Within free tier (200M req/month) but would have exceeded if continued
- **User impact**: Potential billing concern, service degradation risk

## Resolution

1. Removed `book` and `error` from `pollJobStatus` dependencies
2. Fetch latest state inside polling function instead
3. Added proper interval cleanup
4. Deployed fixed version

## Prevention

Added to `.kiro/steering/react-polling-patterns.md`:
- Mandatory polling safeguards (max duration, terminal state checks)
- Dependencies array rules (no state variables)
- Pre-deployment verification checklist
- Code review requirements

## Lessons Learned

- State variables in polling callback dependencies are dangerous
- Must verify polling behavior in browser before deploy
- Need automated safeguards (max duration, request counting)
- Early phase development still requires careful review of billing-critical code
