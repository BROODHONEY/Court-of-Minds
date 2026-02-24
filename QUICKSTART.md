# Court of Minds - Quick Start Guide

Get up and running with Court of Minds in 5 minutes!

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Add at least one API key to `.env`:**
   ```env
   # Add at least one of these:
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=...
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:3000
   ```

That's it! You're ready to start deliberating.

## First Query

### Single-Model Mode (Quick Answer)

1. Select "Single Model" mode
2. Choose a model from the dropdown
3. Type your question: "What is the best way to learn programming?"
4. Click "Submit Query"
5. Get an instant response from one AI model

### Multi-Model Mode (Deliberation)

1. Select "Multi-Model Deliberation" mode
2. Check at least 2 models (more models = deeper deliberation)
3. Type your question: "What is the best way to learn programming?"
4. Click "Submit Query"
5. Watch as multiple AI models:
   - Generate independent responses
   - Analyze differences
   - Debate approaches
   - Build consensus

## What Happens During Deliberation?

```
Phase 1: Response Collection
├─ Model A generates response
├─ Model B generates response
└─ Model C generates response

Phase 2: Analysis
└─ System identifies similarities and differences

Phase 3: Debate (1-5 rounds)
├─ Models critique each other's responses
├─ Models defend their approaches
└─ Models revise positions based on feedback

Phase 4: Consensus
└─ Models agree on final solution
```

## Example Questions to Try

### Technical Questions
- "How should I structure a REST API for a social media app?"
- "What's the best approach to handle authentication in a web app?"
- "Should I use SQL or NoSQL for my project?"

### Design Questions
- "What are the key principles of good UI design?"
- "How do I make my website more accessible?"
- "What color scheme works best for a productivity app?"

### Strategic Questions
- "What's the best way to learn a new programming language?"
- "How should I prioritize features for my MVP?"
- "What's the most effective way to debug complex issues?"

## Understanding the Results

### Single-Model Results
- Direct answer from one AI model
- Fast response (typically 5-10 seconds)
- Good for straightforward questions

### Multi-Model Results
- **Responses:** See what each model initially thought
- **Analysis:** Understand where models agree/disagree
- **Debate:** Watch models challenge and refine ideas
- **Consensus:** Get a thoroughly vetted final answer

The consensus solution incorporates insights from all models and represents the collective intelligence of multiple AI systems.

## Tips for Best Results

1. **Be Specific:** Clear questions get better answers
   - ❌ "How do I code?"
   - ✅ "What's the best way to learn Python for data science?"

2. **Choose Models Wisely:**
   - 2-3 models: Quick deliberation (1-2 minutes)
   - 4-5 models: Thorough deliberation (2-3 minutes)
   - 6+ models: Deep deliberation (3-5 minutes)

3. **Review Intermediate Results:**
   - Click on each phase to see details
   - Understand how the consensus was reached
   - Learn from the debate process

4. **Use Session History:**
   - Review past deliberations
   - Compare different approaches
   - Track how models evolve their thinking

## Common Issues

### "No models available"
- Check that you've added API keys to `.env`
- Restart the server after adding keys
- Verify API keys are valid

### "Please select at least 2 models"
- Multi-model mode requires 2+ models
- Switch to single-model mode for one model
- Or add more API keys to enable more models

### Slow responses
- Normal for multi-model mode (2-5 minutes)
- Reduce number of models for faster results
- Check your internet connection
- Verify API rate limits aren't exceeded

## Next Steps

- Read [SETUP.md](SETUP.md) for detailed configuration
- Explore the API endpoints for programmatic access
- Set up PostgreSQL for persistent session storage
- Configure authentication for production use

## Need Help?

- Check the [SETUP.md](SETUP.md) guide for detailed instructions
- Review the troubleshooting section
- Check server logs for error messages

Happy deliberating! 🎯
