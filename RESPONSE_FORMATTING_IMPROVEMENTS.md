# Response Formatting Improvements

## Overview
Enhanced the AI Court System to produce concise, well-formatted responses without markdown formatting or verbose explanations.

## Changes Made

### 1. Stricter Prompt Instructions

#### Debate Prompts
- Added explicit "NO markdown formatting" rules
- Specified maximum sentence limits (2-3 per section)
- Removed verbose context (truncated to 150-300 chars)
- Emphasized plain text only

#### Consensus Prompts
- Limited solutions to 4-5 sentences maximum
- Restricted insights to 2-3 comma-separated phrases
- Added "no preamble, no fluff" directive
- Removed philosophical/elaborate explanations

### 2. Response Post-Processing

#### Markdown Stripping
Added automatic removal of:
- `###` headers
- `**bold**` formatting
- Bullet points (`-`, `*`, `•`)
- Numbered lists (`1.`, `2.`, etc.)

#### Length Enforcement
- Debate responses: 500 char max per section
- Consensus solutions: 800 char max
- Insights: 150 char max each, limited to 3 total

### 3. Token Limit Reduction
- Reduced debate token limit from 500 to 400
- Added stricter enforcement for verbose models
- Groq models now have tighter constraints

### 4. System Message Support

Added `systemMessage` field to Context interface:
```typescript
interface Context {
  systemMessage?: string;
  // ... other fields
}
```

All adapters now inject formatting instructions:
- "You must be concise"
- "Avoid markdown formatting"
- "Write in plain text paragraphs only"
- "Maximum 3-4 sentences per section"

### 5. Updated Components

**DebateOrchestrator.ts**
- Streamlined debate prompts
- Added markdown stripping in parser
- Reduced token limits
- Injected system messages

**ConsensusBuilder.ts**
- Simplified consensus prompts
- Added markdown stripping in parser
- Enforced length limits
- Concise rationale generation

**AnalysisEngine.ts**
- Condensed summary generation
- Removed redundant phrasing

**All Adapters** (Groq, OpenAI, Anthropic, Google)
- Added systemMessage support
- Prioritized formatting instructions

## Expected Results

Responses will now be:
- ✅ Plain text only (no markdown)
- ✅ Concise (4-5 sentences max for solutions)
- ✅ Direct and actionable
- ✅ Free of verbose philosophical discussions
- ✅ Properly formatted without elaborate structure

## Example Before/After

### Before
```
### 1. **Robin Hood (Robs the Rich to Give to the Poor)**
   - **Intent**: Acts to redistribute wealth...
   - **Ethics**: While illegal, the motive is altruistic...
   - **Impact**: Temporarily alleviates suffering...
   - **Moral Ambiguity**: Theft is still theft...
```

### After
```
REVISED_POSITION: Robin Hood's actions address immediate inequality by redistributing wealth from the privileged to the marginalized. While technically illegal, the altruistic motive challenges systemic exploitation. However, this approach doesn't solve root causes like corruption or oppression. The moral ambiguity lies in balancing vigilante justice against the rule of law.
```
