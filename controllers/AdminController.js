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

    const parentCategories = kind === "categories"
        ? await AdminModel.parentOptions()
        : [];

    return res.status(status).render("admin/form", {
        title: `${item.id ? "Sửa" : "Thêm"} ${config[kind].singular}`,
        active: kind,
        kind,
        label: config[kind].label,
        item,
        errors,
        categories,
        parentCategories
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
                    parent_id: "",
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
            let data = {};

            try {
                if (id && !validId(id)) {
                    return res.status(400).send("Mã dữ liệu không hợp lệ.");
                }

                const validation = kind === "products"
                    ? validateProduct(req.body)
                    : validateCategory(req.body);

                data = validation.data;
                const errors = validation.errors;

                let existing = null;

                if (id) {
                    existing = await AdminModel.find(kind, id);

                    if (!existing) {
                        return res.status(404).send("Dữ liệu không còn tồn tại.");
                    }
                }

                const rootCategories = await AdminModel.parentOptions();

                if (kind === "categories") {
                    data.parent_id = text(req.body.parent_id);

                    const isProtectedRoot = existing && rootCategories.some(
                        root => String(root.id) === String(existing.id)
                    );

                    if (isProtectedRoot) {
                        errors.name = "Nam và Nữ là nhóm gốc, không chỉnh sửa tại đây.";
                    }

                    if (!validId(data.parent_id)) {
                        errors.parent_id = "Vui lòng chọn nhóm Nam hoặc Nữ.";
                    } else {
                        const parent = rootCategories.find(
                            root => String(root.id) === String(data.parent_id)
                        );

                        if (!parent) {
                            errors.parent_id = "Nhóm cha phải là Nam hoặc Nữ.";
                        }

                        if (id && String(id) === String(data.parent_id)) {
                            errors.parent_id = "Danh mục không thể là cha của chính nó.";
                        }
                    }

                    if (id && await AdminModel.hasChildren(id)) {
                        errors.parent_id =
                            "Danh mục đang có danh mục con, không thể chuyển thành danh mục con.";
                    }
                }

                if (kind === "products" && !errors.category_id) {
                    const category = await AdminModel.find(
                        "categories",
                        data.category_id
                    );

                    const belongsToRoot = category && rootCategories.some(
                        root => String(root.id) === String(category.parent_id)
                    );

                    if (!category) {
                        errors.category_id = "Danh mục không còn tồn tại.";
                    } else if (!belongsToRoot) {
                        errors.category_id =
                            "Hãy chọn danh mục con thuộc Nam hoặc Nữ.";
                    }
                }

                if (Object.keys(errors).length > 0) {
                    return await renderForm(
                        res,
                        kind,
                        { ...data, id },
                        errors,
                        400
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
                let formErrors = null;

                if (error.code === "ER_DUP_ENTRY") {
                    formErrors = {
                        name: "Tên đã được sử dụng. Vui lòng chọn tên khác."
                    };
                }

                if (error.code === "ER_NO_REFERENCED_ROW_2") {
                    const field = kind === "categories"
                        ? "parent_id"
                        : "category_id";

                    formErrors = {
                        [field]: "Danh mục được chọn không còn tồn tại."
                    };
                }

                if (formErrors) {
                    try {
                        return await renderForm(
                            res,
                            kind,
                            { ...data, id },
                            formErrors,
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

                if (kind === "categories") {
                    const roots = await AdminModel.parentOptions();

                    const isRoot = roots.some(
                        root => String(root.id) === String(req.params.id)
                    );

                    if (isRoot) {
                        return redirectWithFlash(
                            req,
                            res,
                            next,
                            "/admin/categories",
                            "error",
                            "Không thể xóa hai nhóm gốc Nam và Nữ."
                        );
                    }
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
                            ? "Không thể xóa danh mục đang chứa sản phẩm hoặc danh mục con."
                            : "Không thể xóa sản phẩm đang được dữ liệu khác tham chiếu."
                    );
                }

                return next(error);
            }
        };
    }
};

module.exports = AdminController;