const CookbookRecipe = require('../models/cookbookModel');

const saveRecipe = async (req, res) => {
    try {
        const { name, time, difficulty, calories, ingredients, instructions } = req.body;

        const recipe = await CookbookRecipe.create({
            userId: req.user._id,
            name, time, difficulty, calories, ingredients, instructions
        });

        res.status(201).json(recipe);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMyRecipes = async (req, res) => {
    try {
        const recipes = await CookbookRecipe.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteRecipe = async (req, res) => {
    try {
        const recipe = await CookbookRecipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Not found' });

        if (recipe.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await recipe.deleteOne();
        res.json({ message: 'Deleted', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { saveRecipe, getMyRecipes, deleteRecipe };