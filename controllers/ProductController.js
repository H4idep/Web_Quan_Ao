const ProductModel = require("../models/ProductModel");

function validId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d{0,19}$/.test(value)
    ) {
        return false;
    }

    return BigInt(value) <= 18446744073709551615n;
}

function formatMoney(value) {
    return Number(value).toLocaleString("vi-VN", {
        maximumFractionDigits: 2
    }) + " đ";
}

const ProductController = {
    async index(req, res, next) {
        try {
            const rawCategoryId = req.query.category;
            const searchQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";

            let categoryId = null;
            let selectedCategory = null;

            if (rawCategoryId !== undefined) {
                if (!validId(rawCategoryId)) {
                    return res.status(400).send("Mã danh mục không hợp lệ.");
                }

                selectedCategory = await ProductModel.findCategoryById(
                    rawCategoryId
                );

                if (!selectedCategory) {
                    return res.status(404).send("Danh mục không tồn tại.");
                }

                categoryId = rawCategoryId;
            }

            const products = await ProductModel.findAll(categoryId, searchQuery);

            let pageTitle = "Tất cả sản phẩm";
            if (searchQuery) {
                pageTitle = `Kết quả tìm kiếm cho: "${searchQuery}"`;
            } else if (selectedCategory) {
                pageTitle = selectedCategory.name;
            }

            return res.render("products/index", {
                products,
                formatMoney,
                selectedCategory,
                searchQuery,
                pageTitle
            });
        } catch (error) {
            return next(error);
        }
    },

    async suggest(req, res, next) {
        try {
            const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
            if (!query || query.length < 1) {
                return res.json([]);
            }
            const items = await ProductModel.searchSuggestions(query, 5);
            const result = items.map(p => ({
                id: p.id,
                name: p.name,
                priceFormatted: formatMoney(p.price),
                image_url: p.image_url || "/images/no-image.png"
            }));
            return res.json(result);
        } catch (error) {
            return next(error);
        }
    },

    async detail(req, res, next) {
        try {
            const id = req.params.id;

            if (!validId(id)) {
                return res.status(400).send(
                    "Mã sản phẩm không hợp lệ."
                );
            }

            const product = await ProductModel.findById(id);

            if (!product) {
                return res.status(404).send(
                    "Sản phẩm không tồn tại hoặc đã bị xóa."
                );
            }

            return res.render("products/detail", {
                product,
                formatMoney
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = ProductController;