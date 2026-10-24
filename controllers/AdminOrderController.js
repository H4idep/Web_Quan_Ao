const AdminOrderModel = require("../models/AdminOrderModel");

const {
    STATUSES,
    TRANSITIONS,
    validateFilters,
    validateChange
} = require("../validators/adminOrderValidator");

async function renderDetail(req, res, options = {}) {
    const order = await AdminOrderModel.detail(req.params.id);

    if (!order) {
        return res.status(404).send("Không tìm thấy đơn hàng.");
    }

    return res.status(options.httpStatus || 200).render(
        "admin/orders/detail",
        {
            title: `Đơn hàng ${order.order_number}`,
            active: "orders",
            order,
            statuses: STATUSES,
            nextStatuses: TRANSITIONS[order.status] || [],
            error: options.error || "",
            reason: options.reason || ""
        }
    );
}

const AdminOrderController = {
    async index(req, res, next) {
        try {
            const filters = validateFilters(req.query);
            const result = await AdminOrderModel.list(filters);

            return res.render("admin/orders/index", {
                title: "Quản lý đơn hàng",
                active: "orders",
                filters,
                statuses: STATUSES,
                ...result
            });
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).send(error.message);
            }

            return next(error);
        }
    },

    async detail(req, res, next) {
        try {
            return await renderDetail(req, res);
        } catch (error) {
            return next(error);
        }
    },

    async changeStatus(req, res, next) {
        try {
            const data = validateChange(req.body);

            await AdminOrderModel.changeStatus(
                req.params.id,
                res.locals.currentUser.id,
                data
            );

            req.session.adminFlash = {
                type: "success",
                message: `Đã chuyển đơn hàng sang: ${STATUSES[data.status]}.`
            };

            return req.session.save(error => {
                if (error) return next(error);

                return res.redirect(`/admin/orders/${req.params.id}`);
            });
        } catch (error) {
            if (error.status === 404) {
                return res.status(404).send(error.message);
            }

            if ([400, 409].includes(error.status)) {
                try {
                    return await renderDetail(req, res, {
                        httpStatus: error.status,
                        error: error.message,
                        reason: typeof req.body?.reason === "string"
                            ? req.body.reason.slice(0, 500)
                            : ""
                    });
                } catch (renderError) {
                    return next(renderError);
                }
            }

            return next(error);
        }
    }
};

module.exports = AdminOrderController;