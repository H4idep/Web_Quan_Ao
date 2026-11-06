const addressCatalog = require("../config/addressCatalog");

function getText(value) {
    return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function getName(value) {
    return getText(value).replace(/\s+/gu, " ");
}

function getVietnamToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const get = type => parts.find(part => part.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function validBirthday(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1900) return false;

    const date = new Date(Date.UTC(year, month - 1, day));
    const exists =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

    return exists && value <= getVietnamToday();
}

function validateUpdateProfile(body) {
    const data = {
        lastName: getName(body.lastName),
        firstName: getName(body.firstName),
        phone: getText(body.phone),
        birthday: getText(body.birthday),
        gender: getText(body.gender),
        province: getText(body.province),
        district: getText(body.district),
        ward: getText(body.ward),
        address: getText(body.address),
        newsletter: body.newsletter === "1"
    };

    const errors = {};

    const namePattern = /^\p{L}[\p{L}\p{M}]*(?:[ '’-][\p{L}\p{M}]+)*$/u;
    for (const key of ["lastName", "firstName"]) {
        if (!data[key] || data[key].length > 50 || !namePattern.test(data[key])) {
            errors[key] = "Chỉ nhập chữ và khoảng trắng, tối đa 50 ký tự.";
        }
    }

    data.fullName = `${data.lastName} ${data.firstName}`.trim();
    if (data.fullName.length > 100) {
        errors.firstName = "Họ và tên vượt quá 100 ký tự.";
    }

    if (!/^0[35789]\d{8}$/.test(data.phone)) {
        errors.phone = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";
    }

    if (!validBirthday(data.birthday)) {
        errors.birthday = "Ngày sinh không hợp lệ hoặc lớn hơn ngày hiện tại.";
    }

    if (!["Nam", "Nữ", "Khác"].includes(data.gender)) {
        errors.gender = "Vui lòng chọn giới tính hợp lệ.";
    }

    // Kiểm tra địa chỉ theo danh mục 2 cấp (Tỉnh/Thành -> Phường/Xã)
    const provinceExists = Object.hasOwn(addressCatalog, data.province);
    const wards = provinceExists ? addressCatalog[data.province] : [];

    if (!provinceExists) {
        errors.addressHierarchy = "Vui lòng chọn Tỉnh/Thành phố trong danh mục.";
    } else if (!wards.includes(data.ward)) {
        errors.addressHierarchy = "Phường/Xã không thuộc Tỉnh/Thành phố đã chọn.";
    }


    return { data, errors };
}

module.exports = {
    validateUpdateProfile
};
