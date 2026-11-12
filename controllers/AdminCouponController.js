const AdminCouponModel = require("../models/AdminCouponModel");
const {
    validateFilters,
    validateCoupon,
    validId
} = require("../validators/adminCouponValidator");

function formDefaults() {
    return {
        code: "",
        description: "",
        discount_type: "percentage",
        discount_value: "",
        max_discount_amount: "",
        min_order_value: "0.00",
        usage_limit: "",
        start_date_input: "",
        end_date_input: "",
        is_active: 1
    };
}

function formItemFrom(data) {
    return {
        ...formDefaults(),
        ...data,
        max_discount_amount: data.max_discount_amount || "",
        usage_limit: data.usage_limit || "",
        start_date_input: data.start_date
            ? data.start_date.replace(" ", "T").slice(0, 16)
            : "",
        end_date_input: data.end_date
            ? data.end_date.replace(" ", "T").slice(0, 16)
            : ""
    };
}

function redirectWithFlash(req, res, next, message) {
    req.session.adminFlash = { type: "success", message };
    return req.session.save(error => {
        if (error) return next(error);
        return res.redirect("/admin/coupons");
    });
}

function respondWithFlash(req, res, next, message) {
    req.session.adminFlash = { type: "success", message };
    return req.session.save(error => {
        if (error) return next(error);
        return res.json({ success: true, message });
    });
}

function renderForm(res, item, errors = {}, status = 200) {
    return res.status(status).render("admin/coupons/form", {
        title: item.id ? `Mã giảm giá ${item.code}` : "Thêm mã giảm giá",
        active: "coupons",
        item,
        errors
    });
}

function duplicateResponse(res) {
    return res.status(409).json({
        success: false,
        message: "Mã giảm giá đã tồn tại.",
        errors: { code: "Mã giảm giá đã tồn tại." }
    });
}

const AdminCouponController = {
    async index(req, res, next) {
        try {
            const filters = validateFilters(req.query);
            const result = await AdminCouponModel.list(filters);
            return res.render("admin/coupons/index", {
                title: "Mã giảm giá",
                active: "coupons",
                filters,
                ...result
            });
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).send(error.message);
            }
            return next(error);
        }
    },

    createForm(req, res) {
        return renderForm(res, formDefaults());
    },

    async detail(req, res, next) {
        try {
            if (!validId(req.params.id)) {
                return res.status(400).send("Mã giảm giá không hợp lệ.");
            }
            const item = await AdminCouponModel.findById(req.params.id);
            if (!item) return res.status(404).send("Mã giảm giá không tồn tại.");
            return renderForm(res, item);
        } catch (error) {
            return next(error);
        }
    },

    async create(req, res, next) {
        const { data, errors } = validateCoupon(req.body);
        if (Object.keys(errors).length) {
            return renderForm(res, formItemFrom(data), errors, 400);
        }

        try {
            if (await AdminCouponModel.codeExists(data.code)) {
                return renderForm(
                    res,
                    formItemFrom(data),
                    { code: "Mã giảm giá đã tồn tại." },
                    409
                );
            }
            await AdminCouponModel.create(data);
            return redirectWithFlash(req, res, next, "Đã tạo mã giảm giá.");
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return renderForm(
                    res,
                    formItemFrom(data),
                    { code: "Mã giảm giá đã tồn tại." },
                    409
                );
            }
            return next(error);
        }
    },

    async update(req, res, next) {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá không hợp lệ."
            });
        }

        const { data, errors } = validateCoupon(req.body);
        if (Object.keys(errors).length) {
            return res.status(400).json({
                success: false,
                message: "Thông tin chưa hợp lệ.",
                errors
            });
        }

        try {
            const current = await AdminCouponModel.findById(req.params.id);
            if (!current) {
                return res.status(404).json({
                    success: false,
                    message: "Mã giảm giá không tồn tại."
                });
            }
            if (await AdminCouponModel.codeExists(data.code, req.params.id)) {
                return duplicateResponse(res);
            }
            const updated = await AdminCouponModel.update(req.params.id, data);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: "Mã giảm giá không tồn tại."
                });
            }
            return respondWithFlash(req, res, next, "Đã cập nhật mã giảm giá.");
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return duplicateResponse(res);
            }
            return next(error);
        }
    },

    async toggle(req, res, next) {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá không hợp lệ."
            });
        }
        try {
            const updated = await AdminCouponModel.toggle(req.params.id);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: "Mã giảm giá không tồn tại."
                });
            }
            return respondWithFlash(req, res, next, "Đã thay đổi trạng thái mã giảm giá.");
        } catch (error) {
            return next(error);
        }
    },

    async remove(req, res, next) {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Mã giảm giá không hợp lệ."
            });
        }
        try {
            const result = await AdminCouponModel.remove(req.params.id);
            if (!result.found) {
                return res.status(404).json({
                    success: false,
                    message: "Mã giảm giá không tồn tại."
                });
            }
            if (result.blocked) {
                return res.status(409).json({
                    success: false,
                    message: "Không thể xóa vì mã giảm giá đã được sử dụng hoặc được tham chiếu bởi đơn hàng."
                });
            }
            return respondWithFlash(req, res, next, "Đã xóa mã giảm giá.");
        } catch (error) {
            if (error.code === "ER_ROW_IS_REFERENCED_2") {
                return res.status(409).json({
                    success: false,
                    message: "Không thể xóa vì dữ liệu khác đang tham chiếu mã giảm giá."
                });
            }
            return next(error);
        }
    }
};

module.exports = AdminCouponController;
