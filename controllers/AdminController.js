const AdminModel = require("../models/AdminModel");

const {
    text,
    validId,
    validateCategory,
    validateProduct
} = require("../validators/adminValidator");

const config = {
    categories: {
        label: "Danh mục",
        singular: "danh mục"
    },
    products: {
        label: "Sản phẩm",
        singular: "sản phẩm"
    }
};

function redirectWithFlash(req, res, next, url, type, message) {
    req.session.adminFlash = { type, message };

    req.session.save(error => {
        if (error) {
            return next(error);
        }

        return res.redirect(url);
    });
}

async function renderForm(res, kind, item, errors = {}, status = 200) {
    const categories = kind === "products"
        ? await AdminModel.categoryOptions()
        : [];

    return res.status(status).render("admin/form", {
        title: `${item.id ? "Sửa" : "Thêm"} ${config[kind].singular}`,
        active: kind,
        kind,
        label: config[kind].label,
        item,
        errors,
        categories
    });
}

const AdminController = {
    async dashboard(req, res, next) {
        try {
            const stats = await AdminModel.dashboard();

            return res.render("admin/dashboard", {
                title: "Tổng quan",
                active: "dashboard",
                stats
            });
        } catch (error) {
            return next(error);
        }
    },

    list(kind) {
        return async (req, res, next) => {
            try {
                const q = text(req.query.q).slice(0, 100);
                const rawPage = text(req.query.page);

                const page = /^[1-9]\d{0,5}$/.test(rawPage)
                    ? Number(rawPage)
                    : 1;

                const result = await AdminModel.list(kind, q, page);

                return res.render("admin/list", {
                    title: config[kind].label,
                    active: kind,
                    kind,
                    label: config[kind].label,
                    q,
                    ...result
                });
            } catch (error) {
                return next(error);
            }
        };
    },

    createForm(kind) {
        return async (req, res, next) => {
            try {
                return await renderForm(res, kind, {
                    name: "",
                    description: "",
                    category_id: "",
                    price: "",
                    stock: "0",
                    image_url: ""
                });
            } catch (error) {
                return next(error);
            }
        };
    },

    editForm(kind) {
        return async (req, res, next) => {
            try {
                if (!validId(req.params.id)) {
                    return res.status(400).send("Mã dữ liệu không hợp lệ.");
                }

                const item = await AdminModel.find(kind, req.params.id);

                if (!item) {
                    return res.status(404).send("Dữ liệu không tồn tại.");
                }

                return await renderForm(res, kind, item);
            } catch (error) {
                return next(error);
            }
        };
    },

    save(kind) {
        return async (req, res, next) => {
            const id = req.params.id || null;

            const validation = kind === "products"
                ? validateProduct(req.body)
                : validateCategory(req.body);

            const { data, errors } = validation;

            try {
                if (id) {
                    if (!validId(id)) {
                        return res.status(400).send("Mã dữ liệu không hợp lệ.");
                    }

                    const existing = await AdminModel.find(kind, id);

                    if (!existing) {
                        return res.status(404).send("Dữ liệu không còn tồn tại.");
                    }
                }

                if (kind === "products" && !errors.category_id) {
                    const category = await AdminModel.find(
                        "categories",
                        data.category_id
                    );

                    if (!category) {
                        errors.category_id = "Danh mục không còn tồn tại.";
                    }
                }

                if (Object.keys(errors).length > 0) {
                    return await renderForm(
                        res, kind, { ...data, id }, errors, 400
                    );
                }

                if (kind === "categories") {
                    await AdminModel.saveCategory(id, data);
                } else {
                    await AdminModel.saveProduct(id, data);
                }

                return redirectWithFlash(
                    req,
                    res,
                    next,
                    `/admin/${kind}`,
                    "success",
                    `${id ? "Cập nhật" : "Thêm"} ${config[kind].singular} thành công.`
                );
            } catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    try {
                        return await renderForm(
                            res,
                            kind,
                            { ...data, id },
                            { name: "Tên danh mục đã được sử dụng." },
                            409
                        );
                    } catch (renderError) {
                        return next(renderError);
                    }
                }

                if (error.code === "ER_NO_REFERENCED_ROW_2") {
                    try {
                        return await renderForm(
                            res,
                            kind,
                            { ...data, id },
                            { category_id: "Danh mục đã bị xóa. Hãy chọn lại." },
                            409
                        );
                    } catch (renderError) {
                        return next(renderError);
                    }
                }

                return next(error);
            }
        };
    },

    remove(kind) {
        return async (req, res, next) => {
            try {
                if (!validId(req.params.id)) {
                    return res.status(400).send("Mã dữ liệu không hợp lệ.");
                }

                const affected = await AdminModel.remove(kind, req.params.id);

                if (!affected) {
                    return res.status(404).send("Dữ liệu không còn tồn tại.");
                }

                return redirectWithFlash(
                    req,
                    res,
                    next,
                    `/admin/${kind}`,
                    "success",
                    `Đã xóa ${config[kind].singular}.`
                );
            } catch (error) {
                if (error.code === "ER_ROW_IS_REFERENCED_2") {
                    return redirectWithFlash(
                        req,
                        res,
                        next,
                        `/admin/${kind}`,
                        "error",
                        kind === "categories"
                            ? "Không thể xóa danh mục đang chứa sản phẩm."
                            : "Không thể xóa sản phẩm đang được dữ liệu khác tham chiếu."
                    );
                }

                return next(error);
            }
        };
    }
};

module.exports = AdminController;