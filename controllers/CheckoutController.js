const CartModel = require("../models/CartModel");
const OrderModel = require("../models/OrderModel");
const UserModel = require("../models/UserModel");
const { validateCheckout } = require("../validators/orderValidator");
const { formatMoney, imagePath } = require("../utils/format");

function setCartFlash(req, type, message) {
    req.session.cartFlash = { type, message };
}

// Số sản phẩm tối đa chọn đặt trong một đơn (khớp parameterLimit trong app.js).
const MAX_SELECTED = 50;

// Lấy danh sách id sản phẩm được chọn từ query (GET) hoặc body (POST).
// Trả về mảng id không trùng lặp, hoặc null nếu dữ liệu không hợp lệ.
// Mảng rỗng nghĩa là người dùng chưa chọn gì.
function parseSelected(value) {
    if (value === undefined) {
        return [];
    }

    const list = Array.isArray(value) ? value : [value];

    if (list.length > MAX_SELECTED) {
        return null;
    }

    const ids = [];

    for (const id of list) {
        if (typeof id !== "string" || !/^[1-9]\d{0,19}$/.test(id)) {
            return null;
        }

        if (BigInt(id) > 18446744073709551615n) {
            return null;
        }

        if (!ids.includes(id)) {
            ids.push(id);
        }
    }

    return ids;
}

// Trả về lý do không cho đặt hàng, hoặc null nếu các món được chọn hợp lệ.
// selectedIds: các id người dùng đã chọn; items: các món tìm thấy trong giỏ.
function cartProblem(selectedIds, items) {
    if (selectedIds === null) {
        return "Dữ liệu sản phẩm đã chọn không hợp lệ.";
    }

    if (selectedIds.length === 0) {
        return "Vui lòng chọn ít nhất một sản phẩm để đặt hàng.";
    }

    if (items.length !== selectedIds.length) {
        return "Một số sản phẩm đã chọn không còn trong giỏ hàng. Hãy kiểm tra lại.";
    }

    if (items.some(item => Number(item.stock) < Number(item.quantity))) {
        return "Có sản phẩm đã chọn đã hết hàng hoặc vượt tồn kho. Hãy điều chỉnh giỏ hàng trước khi đặt.";
    }

    return null;
}

function renderCheckout(res, items, selectedIds, form, errors = {}, status = 200) {
    const subtotal = items.reduce(
        (sum, item) => sum + Number(item.line_total),
        0
    );

    return res.status(status).render("checkout/index", {
        items,
        selectedIds,
        subtotal,
        form,
        errors,
        formatMoney,
        imagePath
    });
}

const CheckoutController = {
    async show(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const selectedIds = parseSelected(req.query.selected);
            const items = await CartModel.getItems(user.id, selectedIds);
            const problem = cartProblem(selectedIds, items);

            if (problem) {
                setCartFlash(req, "error", problem);

                return res.redirect("/cart");
            }

            // Điền sẵn từ hồ sơ để khách đỡ phải gõ lại.
            const profile = await UserModel.findCheckoutProfile(user.id);

            const form = {
                customerName: profile.full_name,
                phone: profile.phone,
                shippingAddress: [
                    profile.address,
                    profile.ward,
                    profile.district,
                    profile.province
                ]
                    .filter(Boolean)
                    .join(", "),
                notes: ""
            };

            return renderCheckout(res, items, selectedIds, form);
        } catch (error) {
            return next(error);
        }
    },

    async place(req, res, next) {
        try {
            const user = res.locals.currentUser;
            const selectedIds = parseSelected(req.body.selected);
            const items = await CartModel.getItems(user.id, selectedIds);
            const problem = cartProblem(selectedIds, items);

            if (problem) {
                setCartFlash(req, "error", problem);

                return res.redirect("/cart");
            }

            const { data, errors } = validateCheckout(req.body);

            if (Object.keys(errors).length > 0) {
                return renderCheckout(res, items, selectedIds, data, errors, 400);
            }

            // Kiểm tra tồn kho thật sự nằm trong transaction của OrderModel.
            // Chỉ đặt và xóa khỏi giỏ các món được chọn.
            const result = await OrderModel.createFromCart(user, data, selectedIds);

            if (result.status === "empty") {
                setCartFlash(
                    req,
                    "error",
                    "Một số sản phẩm đã chọn không còn trong giỏ hàng. Hãy kiểm tra lại."
                );

                return res.redirect("/cart");
            }

            if (result.status === "stock") {
                const names = result.problems
                    .map(item =>
                        item.stock > 0
                            ? `${item.name} (còn ${item.stock})`
                            : `${item.name} (hết hàng)`
                    )
                    .join(", ");

                setCartFlash(
                    req,
                    "error",
                    `Không đủ hàng cho: ${names}. Hãy điều chỉnh số lượng rồi đặt lại.`
                );

                return res.redirect("/cart");
            }

            req.session.orderFlash = "placed";

            return res.redirect(`/orders/${result.orderNumber}`);
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = CheckoutController;
