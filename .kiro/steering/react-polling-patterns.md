# React Polling Pattern Standards

**CRITICAL**: Prevent infinite polling loops that cause massive API request storms and billing issues.

## Polling Implementation Rules

### 1. Dependencies Array Management

**FORBIDDEN**:
```typescript
// ❌ BAD - State in dependencies causes infinite loop
const pollData = useCallback(async () => {
  const result = await fetchData();
  setData(result);
}, [data]); // data changes → new callback → new interval → infinite loop
```

**REQUIRED**:
```typescript
// ✅ GOOD - No state dependencies
const pollData = useCallback(async () => {
  const result = await fetchData();
  setData(result);
}, []); // Empty or stable dependencies only
```

### 2. Interval Management

**REQUIRED Pattern**:
```typescript
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Always clear before creating new interval
if (intervalRef.current) {
  clearInterval(intervalRef.current);
}
intervalRef.current = setInterval(pollData, INTERVAL_MS);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };
}, []);
```

### 3. Polling Safeguards

**REQUIRED - Add ALL of these**:

```typescript
const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes
const POLLING_INTERVAL = 2000; // 2 seconds
const pollStartTime = useRef<number>(Date.now());

const pollData = useCallback(async () => {
  // Safeguard 1: Time limit
  if (Date.now() - pollStartTime.current > MAX_POLL_DURATION) {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setError("Processing timeout. Please try again.");
    return;
  }

  // Safeguard 2: Check if already stopped
  if (!intervalRef.current) {
    return;
  }

  // Safeguard 3: Stop on terminal states
  const result = await fetchData();
  if (result.status === "done" || result.status === "error") {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
}, []);
```

### 4. Pre-deployment Verification

**MANDATORY Checks Before Deploy**:
1. Open browser DevTools Network tab
2. Load the page with polling
3. Verify request rate matches POLLING_INTERVAL (e.g., 1 request per 2 seconds)
4. Watch for 30 seconds minimum
5. If you see multiple requests per second → DO NOT DEPLOY

## Code Review Checklist

Before committing polling code:
- [ ] Dependencies array contains NO state variables
- [ ] Interval cleared before creating new one
- [ ] Cleanup function clears interval on unmount
- [ ] Maximum polling duration implemented
- [ ] Terminal state check stops polling
- [ ] Tested in browser with Network tab open

## Incident Reference

**2026-03-11 Infinite Polling Loop**:
- Root cause: `book` state in `pollJobStatus` dependencies
- Impact: 22,261 requests in 30 minutes (1,027 req/sec peak)
- Cost: Within free tier but would have exceeded if continued
- Fix: Removed state from dependencies, added safeguards

## Related

See #[[file:skills/react-native-conventions.md]] for React Native patterns
