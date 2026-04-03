const OpenAI = require('openai');

const generateRecipes = async (req, res) => {
    // 1. 获取前端传来的参数
    const { ingredients, dietaryPreferences } = req.body;

    if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ message: 'No ingredients provided' });
    }

    // 2. 初始化 OpenAI (自动读取 process.env.OPENAI_API_KEY)
    // 确保你的 .env 文件里配置了 OPENAI_API_KEY
    const openai = new OpenAI();

    try {
        // 3. 构建 Prompt (提示词)
        let dietText = "";
        if (dietaryPreferences && dietaryPreferences.length > 0) {
            dietText = `CRITICAL: The user has these dietary restrictions: ${dietaryPreferences.join(', ')}. Do NOT use ingredients that violate these.`;
        }

        const prompt = `
            I have these expiring ingredients: ${ingredients.join(', ')}.
            Please suggest 2 distinct and creative recipes I can cook using these.
            ${dietText}
            
            You must return a valid JSON object with a "recipes" array.
            Structure:
            {
                "recipes": [
                    {
                        "name": "Recipe Name",
                        "time": "15 min",
                        "difficulty": "Easy/Medium/Hard",
                        "calories": "300 kcal",
                        "ingredients": ["Item 1", "Item 2"],
                        "instructions": ["Step 1", "Step 2"]
                    }
                ]
            }
        `;

        // 4. 调用 API
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional chef. You output JSON only." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o-mini", // 或者 "gpt-3.5-turbo-0125"
            response_format: { type: "json_object" }, // ⚡️ 核心：强制 JSON 格式
            temperature: 0.7,
        });

        // 5. 解析结果
        const content = completion.choices[0].message.content;
        if (!content) throw new Error("Empty response from AI");

        const result = JSON.parse(content);

        console.log("✅ OpenAI Generated Recipes Successfully");
        res.json(result);

    } catch (error) {
        console.error('OpenAI API Error:', error);

        // 错误分类处理
        if (error.status === 401) {
            return res.status(500).json({ message: 'Invalid OpenAI API Key' });
        }
        if (error.status === 429) {
            return res.status(500).json({ message: 'OpenAI Quota Exceeded (Check Billing)' });
        }

        res.status(500).json({ message: 'Failed to generate recipes' });
    }
};

module.exports = { generateRecipes };