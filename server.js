require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { initSocket } = require('./socket/socketHandler');
const initCronJobs = require('./jobs/cronScheduler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const fridgeRoutes = require('./routes/fridgeRoutes');
const shoppingRoutes = require('./routes/shoppingRoutes');
const communityRoutes = require('./routes/communityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const cookbookRoutes = require('./routes/cookbookRoutes');
const mealPlanRoutes = require('./routes/mealPlanRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

connectDB();
initCronJobs();
initSocket(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ credentials: true }));
app.use(globalLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'EcoCart API Docs',
    customCss: `
        .swagger-ui .topbar { background-color: #22C55E; }
        .swagger-ui .info .title { color: #22C55E; }
        .swagger-ui .btn.authorize { border-color: #22C55E; color: #22C55E; }
    `,
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, filter: true }
}));

app.get('/', (req, res) => {
    res.json({
        message: 'EcoCart Backend is running!',
        docs: '/api-docs',
        version: '2.0.0',
        features: ['WebSockets', 'Rate Limiting', 'Validation', 'Logging', 'Swagger']
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/fridges', fridgeRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/cookbook', cookbookRoutes);
app.use('/api/meal-plan', mealPlanRoutes);

app.use(errorHandler);

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Swagger docs: http://localhost:${PORT}/api-docs`);
});