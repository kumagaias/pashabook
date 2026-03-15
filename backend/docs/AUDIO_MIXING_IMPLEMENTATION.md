# Audio Mixing Implementation

## Overview

This document describes the implementation of character audio track mixing in VideoCompositor, which enables natural-sounding narration with multiple character voices per page.

## Requirements

- **Requirement 9.4**: Accept array of AudioSegment per page and mix multiple audio tracks
- **Requirement 9.5**: Insert 0.3-second silence padding between narrator and character segments
- **Requirement 9.6**: Apply 50ms crossfade between character voice segments (within dialogue only)

## Implementation Details

### Audio Segment Structure

Each page can have multiple audio segments with different speakers:

```typescript
interface PageNarration {
  pageNumber: number;
  audioSegments: AudioSegment[]; // Multiple audio files per page
  duration: number; // Total duration including padding
  actualDuration: number; // Same as duration
  language: Language;
}

interface AudioSegment {
  audioUrl: string; // Cloud Storage URL
  speaker: 'narrator' | 'protagonist' | 'supporting_character';
  duration: number; // seconds
  startTime: number; // seconds, relative to page start
}
```

### Mixing Logic

The `mixAudioSegments()` method implements three transition types:

#### 1. Narrator ↔ Character Transitions
- **Behavior**: Insert 0.3-second silence padding
- **Purpose**: Creates natural pacing, prevents rushed feeling
- **Implementation**: Use FFmpeg `adelay` filter to position segments with gap

```typescript
// Example: Narrator (3.0s) → 0.3s silence → Protagonist (2.0s)
// Total duration: 5.3s
```

#### 2. Character ↔ Character Transitions
- **Behavior**: Apply 50ms crossfade (overlap)
- **Purpose**: Smooth voice changes within dialogue
- **Implementation**: Use FFmpeg `acrossfade` filter with triangular curves

```typescript
// Example: Protagonist (2.0s) → 50ms crossfade → Supporting Character (1.5s)
// Total duration: 3.45s (2.0 + 1.5 - 0.05)
```

#### 3. Same-Type Consecutive Segments
- **Behavior**: No padding or crossfade
- **Purpose**: Continuous narration or dialogue
- **Implementation**: Direct concatenation with `adelay`

### FFmpeg Filter Chain

The implementation builds a complex filter chain:

1. **Position segments in time** using `adelay` filter
2. **Apply crossfades** using `acrossfade` filter for character-to-character transitions
3. **Mix all streams** using `amix` filter with `duration=longest`

Example filter chain for 3 segments (narrator → protagonist → supporting_character):

```
[0:a]adelay=0|0[delayed0];
[1:a]adelay=3300|3300[delayed1];
[2:a]adelay=5350|5350[delayed2];
[delayed1][delayed2]acrossfade=d=0.05:c1=tri:c2=tri[crossfade1];
[delayed0][crossfade1]amix=inputs=2:duration=longest[aout]
```

### Key Implementation Details

1. **Segment Processing**: Iterate through segments and determine transition type
2. **Crossfade Handling**: When applying crossfade, process two segments together and skip the next iteration
3. **Time Tracking**: Maintain `currentTime` to position each segment correctly
4. **Label Management**: Track processed segments in `processedSegments` array for final mixing

## Testing

All tests pass (42 tests):
- Audio mixing logic validation
- Transition type identification
- Timing calculations with padding and crossfades
- Duration adjustment integration

## Performance

- **Parallel Processing**: Audio mixing happens per-page in parallel with video processing
- **Memory Efficient**: Temporary files are cleaned up after composition
- **Fast Execution**: FFmpeg handles all mixing in a single pass per page

## Example Scenarios

### Scenario 1: Simple Narration
```
Page 1: [Narrator: 5.0s]
Result: Single audio file, no mixing needed
```

### Scenario 2: Narrator + Character
```
Page 1: [Narrator: 3.0s] → [Protagonist: 2.0s]
Result: 5.3s total (3.0 + 0.3 silence + 2.0)
```

### Scenario 3: Multiple Characters
```
Page 1: [Narrator: 3.0s] → [Protagonist: 2.0s] → [Supporting: 1.5s]
Result: 6.75s total (3.0 + 0.3 + 2.0 - 0.05 crossfade + 1.5)
```

## Related Files

- `backend/src/services/VideoCompositor.ts` - Main implementation
- `backend/src/services/VideoCompositor.test.ts` - Unit tests
- `backend/src/types/models.ts` - Type definitions
