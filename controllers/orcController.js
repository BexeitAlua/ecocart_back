const axios = require('axios');
const FormData = require('form-data');
const OpenAI = require('openai');
const logger = require('../config/logger');

/**
 * @swagger
 * /api/items/scan-receipt:
 *   post:
 *     summary: Scan grocery receipt using OCR and extract food items
 *     tags: [Items]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageBase64]
 *             properties:
 *               imageBase64:
 *                 type: string
 *                 description: Base64 encoded receipt image
 *     responses:
 *       200:
 *         description: Extracted food items from receipt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       unit:
 *                         type: string
 *                       category:
 *                         type: string
 *                       price:
 *                         type: number
 *       400:
 *         description: No image provided or no text found
 *       500:
 *         description: OCR processing failed
 */
const scanReceipt = async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ message: 'No image provided' });
        }

        logger.info('Starting receipt OCR scan...');

        const formData = new FormData();
        formData.append('base64Image', imageBase64);
        formData.append('language', 'rus');
        formData.append('isOverlayRequired', 'false');

        const ocrResponse = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                ...formData.getHeaders(),
                'apikey': process.env.OCR_API_KEY || 'helloworld'
            },
            timeout: 30000
        });

        if (!ocrResponse.data || ocrResponse.data.IsErroredOnProcessing) {
            throw new Error('OCR Processing Failed');
        }

        const parsedText = ocrResponse.data.ParsedResults[0].ParsedText;
        logger.info(`OCR completed, text length: ${parsedText?.length || 0}`);

        if (!parsedText || parsedText.trim() === '') {
            return res.status(400).json({ message: 'Could not read any text from the receipt' });
        }

        logger.info('Sending OCR text to OpenAI for structuring...');

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const prompt = `
            I scanned a grocery receipt (likely in Russian or Kazakh).
            Raw OCR text:
            ---
            ${parsedText}
            ---
            
            You are a smart fridge inventory assistant. Your job is to extract ONLY EDIBLE FOOD and BEVERAGE items from this receipt.
            
            CRITICAL RULES:
            1. IGNORE all non-food items entirely (e.g., plastic bags/пакет, toilet paper, cleaning supplies, cosmetics, pet food).
            2. IGNORE total sums, tax, store names, dates, and card info.
            3. Translate the food item names to English if they are in Russian or Kazakh.
            4. Estimate the most appropriate category from this exact list: ['Dairy', 'Fruit', 'Vegetables', 'Meat', 'Beverages', 'Snacks', 'Other'].
            5. Extract the price for each item if available (as a number).
            
            Return exactly this JSON format:
            {
                "items": [
                    { "name": "Milk", "quantity": 1, "unit": "bottle", "category": "Dairy", "price": 500 }
                ]
            }
            If the receipt contains absolutely no food items, return {"items": []}.
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a receipt parser. Output JSON only.' },
                { role: 'user', content: prompt }
            ],
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.1
        });

        const resultJSON = JSON.parse(completion.choices[0].message.content);
        logger.info(`Receipt scan success. Found ${resultJSON.items.length} food items`);
        res.json(resultJSON);
    } catch (error) {
        logger.error(`scanReceipt error: ${error.message}`);
        res.status(500).json({ message: 'Failed to process receipt' });
    }
};

module.exports = { scanReceipt };