const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'EcoCart API',
            version: '1.0.0',
            description: `
## EcoCart — Food Waste Reduction App

API for the EcoCart mobile app. It helps track products in the fridge, plan meals, and reduce food waste.

### Authentication
Most endpoints require a JWT token. After logging in/registering, you will receive a token and click **Authorize** at the top of the page.
            `
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local Development Server'
            },
            {
                url: 'https://ecocart-backend-production.up.railway.app',
                description: 'Production Server (Railway)'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Введите JWT токен полученный при логине/регистрации'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64abc123def456' },
                        name: { type: 'string', example: 'Jessica Lin' },
                        email: { type: 'string', example: 'jessica@ecocart.app' },
                        ecoPoints: { type: 'number', example: 150 },
                        dietaryPreferences: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['Vegetarian', 'Gluten-Free']
                        },
                        city: { type: 'string', example: 'Almaty' },
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
                    }
                },
                Fridge: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64abc123def456' },
                        name: { type: 'string', example: 'My Fridge' },
                        emoji: { type: 'string', example: '🧊' },
                        inviteCode: { type: 'string', example: 'ECO-ABC123' },
                        members: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    userId: { type: 'string' },
                                    role: { type: 'string', enum: ['owner', 'member'] }
                                }
                            }
                        }
                    }
                },
                FridgeItem: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64abc123def456' },
                        fridgeId: { type: 'string' },
                        name: { type: 'string', example: 'Milk' },
                        expiryDate: { type: 'string', format: 'date', example: '2026-04-10' },
                        category: { type: 'string', example: 'Dairy' },
                        quantity: { type: 'number', example: 1 },
                        unit: { type: 'string', example: 'liter' },
                        status: { type: 'string', enum: ['fresh', 'expiring', 'expired'] },
                        imageUrl: { type: 'string', example: 'https://res.cloudinary.com/...' },
                        addedBy: { type: 'string', example: '64abc123def456' }
                    }
                },
                ShoppingItem: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        fridgeId: { type: 'string' },
                        text: { type: 'string', example: 'Milk' },
                        isCompleted: { type: 'boolean', example: false },
                        addedBy: { type: 'string' },
                        similarInFridge: {
                            type: 'array',
                            items: { type: 'object' }
                        }
                    }
                },
                CommunityPost: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        title: { type: 'string', example: 'Fresh apples available' },
                        description: { type: 'string', example: 'I have extra apples from my garden' },
                        category: { type: 'string', example: 'Fruit' },
                        status: { type: 'string', enum: ['available', 'reserved', 'taken'] },
                        location: {
                            type: 'object',
                            properties: {
                                lat: { type: 'number', example: 43.238 },
                                lng: { type: 'number', example: 76.889 }
                            }
                        },
                        imageUrl: { type: 'string' },
                        createdBy: { type: 'string' }
                    }
                },
                MealPlan: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        fridgeId: { type: 'string' },
                        weekStart: { type: 'string', example: '2026-03-24' },
                        isAiGenerated: { type: 'boolean' },
                        days: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    date: { type: 'string', example: '2026-03-24' },
                                    breakfast: {
                                        type: 'object',
                                        properties: {
                                            recipeName: { type: 'string', example: 'Omelette with tomatoes' },
                                            ingredients: { type: 'array', items: { type: 'string' } },
                                            isAiGenerated: { type: 'boolean' }
                                        }
                                    },
                                    lunch: { type: 'object' },
                                    dinner: { type: 'object' }
                                }
                            }
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', example: 'Error message' }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Registration, login, user profile' },
            { name: 'Fridges', description: 'Managing fridges and participants' },
            { name: 'Items', description: 'Products in the fridge' },
            { name: 'Shopping', description: 'Shopping list' },
            { name: 'Community', description: 'Food exchange with neighbors' },
            { name: 'Recipes', description: 'AI-generated recipes' },
            { name: 'Cookbook', description: 'Saved recipes' },
            { name: 'Notifications', description: 'User notifications' },
            { name: 'Meal Plan', description: 'Weekly meal planning' }
        ]
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);