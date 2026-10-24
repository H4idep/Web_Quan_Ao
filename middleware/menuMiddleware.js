const pool = require("../config/database");

async function loadMenuCategories(req, res, next) {
    try {
        const [rows] = await pool.query(`
            SELECT id, name, parent_id
            FROM categories
            ORDER BY name, id
        `);

        const roots = rows.filter(category =>
            category.parent_id === null &&
            ["Nam", "Nữ"].includes(category.name)
        );

        const displayOrder = ["Nữ", "Nam"];

        roots.sort(
            (a, b) =>
                displayOrder.indexOf(a.name) -
                displayOrder.indexOf(b.name)
        );

        res.locals.menuCategories = roots.map(root => ({
            id: root.id,
            name: root.name,
            children: rows.filter(category =>
                category.parent_id !== null &&
                String(category.parent_id) === String(root.id)
            )
        }));

        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = loadMenuCategories;