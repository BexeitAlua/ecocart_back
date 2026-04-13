const OpenAI = require('openai');

const generateRecipes = async (req, res) => {
    const { ingredients, dietaryPreferences, language } = req.body;

    if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ message: 'No ingredients provided' });
    }

    const getMockRecipes = (lang) => {
        const mocks = {
            'RU': [
                {
                    name: "Быстрый салат из имеющихся ингредиентов",
                    time: "10 мин",
                    difficulty: "Легко",
                    calories: "250 ккал",
                    ingredients: ingredients.slice(0, 3),
                    instructions: ["Промойте ингредиенты", "Нарежьте кубиками", "Смешайте и подавайте"]
                },
                {
                    name: "Домашнее рагу",
                    time: "25 мин",
                    difficulty: "Средне",
                    calories: "450 ккал",
                    ingredients: ingredients,
                    instructions: ["Обжарьте основные ингредиенты", "Добавьте специи по вкусу", "Тушите на медленном огне 15 минут"]
                }
            ],
            'KZ': [
                {
                    name: "Тез дайындалатын салат",
                    time: "10 мин",
                    difficulty: "Оңай",
                    calories: "250 ккал",
                    ingredients: ingredients.slice(0, 3),
                    instructions: ["Өнімдерді жуыңыз", "Төртбұрыштап тураңыз", "Араластырып, дастарханға қойыңыз"]
                },
                {
                    name: "Үй рагуы",
                    time: "25 мин",
                    difficulty: "Орташа",
                    calories: "450 ккал",
                    ingredients: ingredients,
                    instructions: ["Негізгі өнімдерді қуырыңыз", "Дәмдеуіштер қосыңыз", "15 минут бойы баяу отта пісіріңіз"]
                }
            ],
            'EN': [
                {
                    name: "Quick Pantry Salad",
                    time: "10 min",
                    difficulty: "Easy",
                    calories: "250 kcal",
                    ingredients: ingredients.slice(0, 3),
                    instructions: ["Wash the ingredients", "Chop them into bite-sized pieces", "Mix together and serve"]
                },
                {
                    name: "Homemade Medley",
                    time: "25 min",
                    difficulty: "Medium",
                    calories: "450 kcal",
                    ingredients: ingredients,
                    instructions: ["Sauté the main ingredients", "Add seasoning to taste", "Simmer on low heat for 15 minutes"]
                }
            ]
        };
        return { recipes: mocks[lang] || mocks['EN'], isMock: true };
    };

    const openai = new OpenAI();

    try {
        let dietText = "";
        if (dietaryPreferences && dietaryPreferences.length > 0) {
            dietText = `CRITICAL: The user has these dietary restrictions: ${dietaryPreferences.join(', ')}. Do NOT use ingredients that violate these.`;
        }

        const targetLang = language === 'RU' ? 'Russian' : (language === 'KZ' ? 'Kazakh' : 'English');

        const prompt = `
            I have these ingredients: ${ingredients.join(', ')}.
            Suggest 2 creative recipes. ${dietText}
            
            CRITICAL REQUIREMENT: 
            All output text (recipe name, difficulty, ingredients, instructions) MUST be entirely in ${targetLang}. 
            (Except for JSON keys which must remain in English).
            
            Return raw JSON format like this:
            {
                "recipes":[
                    {
                        "name": "Название рецепта", 
                        "time": "15 мин",
                        "difficulty": "Легко",
                        "calories": "300 ккал",
                        "ingredients":["Ингредиент 1"],
                        "instructions": ["Шаг 1"]
                    }
                ]
            }
        `;


        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional chef. You output JSON only." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.7,
        }).catch(err => {
            throw err;
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("Empty response from AI");

        const result = JSON.parse(content);

        console.log("OpenAI Generated Recipes Successfully");
        res.json(result);

    } catch (error) {
        console.error('OpenAI API Error:', error);

        const fallbackData = getMockRecipes(language);
        res.json(fallbackData);


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