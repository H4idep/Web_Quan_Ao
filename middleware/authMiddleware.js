const UserModel = require("../models/UserModel");

function getHomeUrl(user) {
    return user.role === "admin" ? "/admin" : "/";
}

async function loadCurrentUser(req, res, next) {
    res.locals.currentUser = null;

    try {
        const userId = req.session.userId;

        if (!userId) {
            return next();
        }

        // Đọc lại quyền và trạng thái từ database mỗi request.
        const user = await UserModel.findSessionUser(userId);

        if (!user || user.status !== "active") {
            return req.session.destroy(error => {
                if (error) {
                    return next(error);
                }

                res.clearCookie("shop.sid", { path: "/" });

                return res.redirect("/login");
            });
        }

        res.locals.currentUser = {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role
        };

        return next();
    } catch (error) {
        return next(error);
    }
}

function requireLogin(req, res, next) {
    if (!res.locals.currentUser) {
        return res.redirect("/login");
    }

    return next();
}

function requireAdmin(req, res, next) {
    if (!res.locals.currentUser) {
        return res.redirect("/login");
    }

    if (res.locals.currentUser.role !== "admin") {
        return res.status(403).send(
            "Bạn không có quyền truy cập chức năng quản trị."
        );
    }

    return next();
}

function guestOnly(req, res, next) {
    if (res.locals.currentUser) {
        return res.redirect(getHomeUrl(res.locals.currentUser));
    }

    return next();
}

module.exports = {
    getHomeUrl,
    loadCurrentUser,
    requireLogin,
    requireAdmin,
    guestOnly
};