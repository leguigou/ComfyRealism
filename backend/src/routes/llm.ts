import express from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.post('/enhance-prompt', authenticate, async (req, res) => {
  try {
    const { prompt, llmUrl, llmModel, systemMessage } = req.body;
    if (!llmUrl || !llmModel) return res.status(400).json({ error: 'LLM configuration missing' });
    
    const response = await axios.post(`${llmUrl}/v1/chat/completions`, {
      model: llmModel,
      messages: [
        { role: "system", content: systemMessage || "You are a professional stable diffusion prompt engineer. Transform user's ideas into highly detailed English prompts. Output JSON with 'positive' and 'negative' keys." }, 
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    }, { timeout: 25000 });
    
    let content = response.data.choices[0].message.content;
    let result = { positive: content, negative: "" };
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try { 
        const parsed = JSON.parse(jsonMatch[0]);
        const pos = parsed.positive || parsed.prompt || parsed.positive_prompt || parsed.text;
        const neg = parsed.negative || parsed.negative_prompt || parsed.neg || "";
        if (pos) { result.positive = pos; result.negative = neg; }
      } catch (e) {}
    }
    res.json({ enhancedPrompt: result.positive, negativePrompt: result.negative });
  } catch (error: any) { 
    res.status(500).json({ error: 'LLM Error: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

router.post('/models', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${req.body.llmUrl}/v1/models`, { timeout: 5000 });
    res.json({ models: response.data.data.map((m: any) => m.id) });
  } catch (error: any) { 
    res.status(500).json({ error: 'Failed to fetch models' }); 
  }
});

router.post('/check', authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${req.body.llmUrl}/v1/models`, { timeout: 3000 });
    res.json({ success: true, count: response.data.data?.length || 0 });
  } catch (error: any) { 
    res.status(500).json({ success: false, error: 'LLM connection failed: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

export default router;
