const CartModel = require("../models/CartModel");

// Gắn số lượng sản phẩm trong giỏ để header hiển thị.
// Phải đặt sau loadCurrentUser.
async function loadCartCount(req, res, next) {
    res.locals.cartCount = 0;

    try {
        if (res.locals.currentUser) {
            res.locals.cartCount = await CartModel.countItems(
                res.locals.currentUser.id
            );
        }

        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = { loadCartCount };
