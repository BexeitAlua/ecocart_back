require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');

let app;

beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', require('../routes/authRoutes'));

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
    });
}, 60000);

afterAll(async () => {
    await mongoose.connection.close();
}, 30000);

describe('Auth API', () => {
    const testUser = {
        name: 'Test User',
        email: `test_${Date.now()}@ecocart.app`,
        password: 'password123'
    };

    describe('POST /api/auth/signup', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(testUser);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.email).toBe(testUser.email);
        }, 30000);

        it('should not register with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ email: 'test@test.com' });
            expect(res.status).toBe(400);
        }, 30000);

        it('should not register duplicate email', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(testUser);
            expect(res.status).toBe(400);
        }, 30000);
    });

    describe('POST /api/auth/login', () => {
        it('should login with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: testUser.password });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
        }, 30000);

        it('should not login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: 'wrongpassword' });
            expect(res.status).toBe(401);
        }, 30000);

        it('should not login with non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'notexist@test.com', password: 'password123' });
            expect(res.status).toBe(401);
        }, 30000);
    });
});