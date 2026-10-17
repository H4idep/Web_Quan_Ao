// Hàm dùng chung cho nhiều controller / view.

function formatMoney(value) {
    return Number(value).toLocaleString("vi-VN", {
        maximumFractionDigits: 2
    }) + " đ";
}

// Chuẩn hóa đường dẫn ảnh sản phẩm (giống logic trong detail.ejs).
function imagePath(value) {
    if (typeof value !== "string") {
        return "";
    }

    let imageUrl = value.trim().split("\\").join("/");

    if (!imageUrl) {
        return "";
    }

    if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
        return imageUrl;
    }

    if (imageUrl.startsWith("//")) {
        return "";
    }

    if (imageUrl.startsWith("/")) {
        return imageUrl;
    }

    if (imageUrl.startsWith("./")) {
        imageUrl = imageUrl.slice(2);
    }

    if (imageUrl.startsWith("public/")) {
        imageUrl = imageUrl.slice(7);
    }

    if (imageUrl.startsWith("images/") || imageUrl.startsWith("uploads/")) {
        return "/" + imageUrl;
    }

    return "";
}

module.exports = { formatMoney, imagePath };
