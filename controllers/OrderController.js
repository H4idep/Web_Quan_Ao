const OrderModel = require("../models/OrderModel");
const { formatMoney, ORDER_STATUS_LABELS } = require("../utils/format");

// Khớp định dạng của OrderModel.generateOrderNumber.
const ORDER_NUMBER_PATTERN = /^DH\d{8}[A-Z2-9]{6}$/;

const OrderController = {
    async show(req, res, next) {
        try {
            const { orderNumber } = req.params;

            // Sai định dạng hoặc không phải đơn của mình: cùng một thông báo.
            const order = ORDER_NUMBER_PATTERN.test(orderNumber)
                ? await OrderModel.findByNumberForUser(
                    res.locals.currentUser.id,
                    orderNumber
                )
                : null;

            if (!order) {
                return res.status(404).send("Không tìm thấy đơn hàng.");
            }

            const justPlaced = req.session.orderFlash === "placed";
            delete req.session.orderFlash;

            return res.render("orders/detail", {
                order,
                justPlaced,
                formatMoney,
                statusLabel: ORDER_STATUS_LABELS[order.status] || order.status
            });
        } catch (error) {
            return next(error);
        }
    }
};

module.exports = OrderController;
