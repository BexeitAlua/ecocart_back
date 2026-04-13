const axios = require('axios');
const FormData = require('form-data');
const OpenAI = require('openai');
const logger = require('../config/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const scanReceipt = async (req, res) => {
    try {
        const { imageBase64, language = 'EN' } = req.body;

        const languageConfig = {
            EN: { ocrLang: 'rus', outputLang: 'English' },
            RU: { ocrLang: 'rus', outputLang: 'Russian' },
            KZ: { ocrLang: 'rus', outputLang: 'Kazakh' }
        };

        const config = languageConfig[language] || languageConfig['EN'];

        if (!imageBase64) {
            return res.status(400).json({ message: 'No image provided' });
        }

        const getMockReceiptData = () => {
            const mockItems = {
                EN: [
                    { name: 'Milk 3.2%', quantity: 1, unit: 'bottle', category: 'Dairy', price: 550 },
                    { name: 'Borodinsky Bread', quantity: 1, unit: 'piece', category: 'Bakery', price: 150 },
                    { name: 'Gala Apples', quantity: 2, unit: 'kg', category: 'Fruit', price: 800 }
                ],
                RU: [
                    { name: 'Молоко 3.2%', quantity: 1, unit: 'бутылка', category: 'Dairy', price: 550 },
                    { name: 'Хлеб Бородинский', quantity: 1, unit: 'шт', category: 'Bakery', price: 150 },
                    { name: 'Яблоки Гала', quantity: 2, unit: 'кг', category: 'Fruit', price: 800 }
                ],
                KZ: [
                    { name: 'Сүт 3.2%', quantity: 1, unit: 'бөтелке', category: 'Dairy', price: 550 },
                    { name: 'Бородинский наны', quantity: 1, unit: 'дана', category: 'Bakery', price: 150 },
                    { name: 'Гала алмасы', quantity: 2, unit: 'кг', category: 'Fruit', price: 800 }
                ]
            };
            return { items: mockItems[language] || mockItems['EN'], isMock: true };
        };

        logger.info(`scanReceipt started | language: ${language}`);

        let parsedText = '';

        try {
            const formData = new FormData();
            formData.append('base64Image', imageBase64);
            formData.append('language', config.ocrLang);
            formData.append('isOverlayRequired', 'false');

            const ocrResponse = await axios.post('https://api.ocr.space/parse/image', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'apikey': process.env.OCR_API_KEY || 'helloworld',
                },
                timeout: 30000,
            });

            if (!ocrResponse.data || ocrResponse.data.IsErroredOnProcessing) {
                throw new Error('OCR Processing Failed');
            }

            parsedText = ocrResponse.data.ParsedResults?.map(r => r.ParsedText).join('\n') || '';
            logger.info(`OCR completed | text length: ${parsedText.length} chars`);

        } catch (ocrError) {
            logger.warn(`OCR API failed or timed out: ${ocrError.message} — returning mock data`);
            return res.json(getMockReceiptData());
        }

        if (!parsedText || parsedText.trim() === '') {
            logger.warn('OCR returned empty text — returning mock data');
            return res.json(getMockReceiptData());
        }

        logger.info(`Sending OCR text to OpenAI | target language: ${config.outputLang}`);

        try {
            const prompt = `
                I scanned a grocery receipt from Kazakhstan.
                Raw OCR text:
                ---
                ${parsedText}
                ---
                
                CRITICAL RULES:
                1. Extract ONLY EDIBLE FOOD and BEVERAGE items. IGNORE plastic bags, toilet paper, cleaning supplies, totals, dates, and store names.
                2. Translate ALL extracted food names into ${config.outputLang}.
                3. Choose the best category from:['Dairy', 'Fruit', 'Vegetables', 'Meat', 'Beverages', 'Snacks', 'Bakery', 'Other'].
                4. Extract the price for each item as an integer.
                
                Return exactly this JSON format:
                {
                    "items":[
                        { "name": "Translated Name in ${config.outputLang}", "quantity": 1, "unit": "piece", "category": "Dairy", "price": 500 }
                    ]
                }
            `;

            const completion = await openai.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are a highly accurate receipt parser. Output strict JSON only.' },
                    { role: 'user', content: prompt }
                ],
                model: 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                temperature: 0.1,
            }, { timeout: 15000 });

            const resultJSON = JSON.parse(completion.choices[0].message.content);
            logger.info(`OpenAI parsing success | ${resultJSON.items?.length || 0} items extracted in ${config.outputLang}`);

            return res.json(resultJSON);

        } catch (aiError) {
            logger.warn(`OpenAI structuring failed or timed out: ${aiError.message} — returning mock data`);
            return res.json(getMockReceiptData());
        }

    } catch (error) {
        logger.error(`scanReceipt global error: ${error.message}`);
        res.status(500).json({ message: 'Process failed' });
    }
};

module.exports = { scanReceipt };