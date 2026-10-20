const CustomerModel = require("../models/CustomerModel");

const {
    validateFilters,
    validateProfile,
    validateStatus
} = require("../validators/customerValidator");

function redirectWithFlash(req, res, next, url, message) {
    req.session.adminFlash = {
        type: "success",
        message
    };

    req.session.save(error => {
        if (error) return next(error);
        return res.redirect(url);
    });
}

function pageNumber(value) {
    if (value === undefined) return 1;

    if (
        typeof value !== "string" ||
        !/^[1-9]\d{0,5}$/.test(value)
    ) {
        const error = new Error("Số trang không hợp lệ.");
        error.status = 400;
        throw error;
    }

    return Number(value);
}

async function renderDetail(req, res, options = {}) {
    const customer = await CustomerModel.find(req.params.id);

    if (!customer) {
        return res.status(404).send("Khách hàng không tồn tại.");
    }

    const [orders, logs] = await Promise.all([
        CustomerModel.orders(
            customer.id,
            pageNumber(req.query.orderPage)
        ),
        CustomerModel.statusLogs(customer.id)
    ]);

    return res.status(options.status || 200).render(
        "admin/customers/detail",
        {
            title: "Chi tiết khách hàng",
            active: "customers",
            customer,
            orders,
            logs,
            form: options.form || customer,
            errors: options.errors || {},
            statusErrors: options.statusErrors || {},
            reason: options.reason || ""
        }
    );
}

const CustomerController = {
    async index(req, res, next) {
        try {
            const { data, errors } = validateFilters(req.query);

            if (errors.length) {
                return res.status(400).render("admin/customers/index", {
                    title: "Khách hàng",
                    active: "customers",
                    filters: data,
                    errors,
                    rows: [],
                    total: 0,
                    page: 1,
                    pages: 1
                });
            }

            const result = await CustomerModel.list(data);

            return res.render("admin/customers/index", {
                title: "Khách hàng",
                active: "customers",
                filters: data,
                errors: [],
                ...result
            });
        } catch (error) {
            return next(error);
        }
    },

    async detail(req, res, next) {
        try {
            return await renderDetail(req, res);
        } catch (error) {
            if (error.status === 400) {
                return res.status(400).send(error.message);
            }

            return next(error);
        }
    },

    async update(req, res, next) {
        const { data, errors } = validateProfile(req.body);

        try {
            if (Object.keys(errors).length) {
                return await renderDetail(req, res, {
                    form: data,
                    errors,
                    status: 400
                });
            }

            await CustomerModel.updateProfile(req.params.id, data);

            return redirectWithFlash(
                req,
                res,
                next,
                `/admin/customers/${req.params.id}`,
                "Đã cập nhật thông tin khách hàng."
            );
        } catch (error) {
            if (error.status === 409) {
                try {
                    return await renderDetail(req, res, {
                        form: data,
                        errors: { form: error.message },
                        status: 409
                    });
                } catch (renderError) {
                    return next(renderError);
                }
            }

            return next(error);
        }
    },

    async changeStatus(req, res, next) {
        const { data, errors } = validateStatus(req.body);

        try {
            if (Object.keys(errors).length) {
                return await renderDetail(req, res, {
                    statusErrors: errors,
                    reason: data.reason,
                    status: 400
                });
            }

            await CustomerModel.changeStatus(
                req.params.id,
                res.locals.currentUser.id,
                data
            );

            return redirectWithFlash(
                req,
                res,
                next,
                `/admin/customers/${req.params.id}`,
                data.status === "blocked"
                    ? "Đã khóa tạm thời tài khoản khách hàng."
                    : "Đã mở khóa. Khách hàng có thể đăng nhập lại."
            );
        } catch (error) {
            if (error.status === 404) {
                return res.status(404).send(error.message);
            }

            if (error.status === 409) {
                try {
                    return await renderDetail(req, res, {
                        statusErrors: { form: error.message },
                        reason: data.reason,
                        status: 409
                    });
                } catch (renderError) {
                    return next(renderError);
                }
            }

            return next(error);
        }
    }
};

module.exports = CustomerController;