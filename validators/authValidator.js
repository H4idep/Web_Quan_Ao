const validator = require("validator");
const addressCatalog = require("../config/addressCatalog");

function getText(value) {
    return typeof value === "string"
        ? value.normalize("NFC").trim()
        : "";
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);

    // Giới hạn dữ liệu cho dự án, không đặt tuổi tối thiểu.
    if (year < 1900) {
        return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    const exists =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

    return exists && value <= getVietnamToday();
}

function validateRegister(body) {
    const data = {
        lastName: getName(body.lastName),
        firstName: getName(body.firstName),
        email: getText(body.email).toLowerCase(),
        phone: getText(body.phone),
        birthday: getText(body.birthday),
        gender: getText(body.gender),
        province: getText(body.province),
        district: getText(body.district),
        ward: getText(body.ward),
        address: getText(body.address),
        newsletter: body.newsletter === "1",
        agreeTerms: body.agreeTerms === "1"
    };

    const errors = {};

    const allowedFields = new Set([
        ...Object.keys(data),
        "password",
        "confirmPassword",
        "captchaInput",
        "_csrf"
    ]);

    // Chặn dữ liệu dạng mảng, đối tượng và trường ngoài hợp đồng form.
    if (
        Object.entries(body).some(
            ([key, value]) =>
                !allowedFields.has(key) ||
                typeof value !== "string"
        )
    ) {
        errors.form = "Dữ liệu gửi lên không hợp lệ.";
    }

    const namePattern =
        /^\p{L}[\p{L}\p{M}]*(?:[ '’-][\p{L}\p{M}]+)*$/u;

    for (const key of ["lastName", "firstName"]) {
        if (
            !data[key] ||
            data[key].length > 50 ||
            !namePattern.test(data[key])
        ) {
            errors[key] =
                "Chỉ nhập chữ, khoảng trắng, dấu nháy hoặc gạch nối; tối đa 50 ký tự.";
        }
    }

    data.fullName = `${data.lastName} ${data.firstName}`.trim();

    if (data.fullName.length > 100) {
        errors.firstName = "Tổng họ tên không được quá 100 ký tự.";
    }

    if (
        data.email.length > 254 ||
        !validator.isEmail(data.email, {
            allow_utf8_local_part: false,
            require_tld: true
        })
    ) {
        errors.email = "Email không đúng định dạng.";
    }

    if (!/^0[35789]\d{8}$/.test(data.phone)) {
        errors.phone =
            "Nhập số di động gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";
    }

    if (!validBirthday(data.birthday)) {
        errors.birthday =
            "Ngày sinh phải tồn tại, từ năm 1900 và không ở tương lai.";
    }

    if (!["Nam", "Nữ", "Khác"].includes(data.gender)) {
        errors.gender = "Giới tính không hợp lệ.";
    }

    const provinceExists = Object.hasOwn(
        addressCatalog,
        data.province
    );

    const districts = provinceExists
        ? addressCatalog[data.province]
        : {};

    const districtExists = Object.hasOwn(
        districts,
        data.district
    );

    if (!provinceExists) {
        errors.province = "Vui lòng chọn tỉnh/thành trong danh mục.";
    }

    if (!districtExists) {
        errors.district = "Quận/huyện không thuộc tỉnh/thành đã chọn.";
    }

    if (
        !districtExists ||
        !districts[data.district].includes(data.ward)
    ) {
        errors.ward = "Phường/xã không thuộc quận/huyện đã chọn.";
    }

    if (
        data.address.length < 5 ||
        data.address.length > 255 ||
        /[\u0000-\u001F\u007F<>]/u.test(data.address)
    ) {
        errors.address =
            "Địa chỉ phải có 5–255 ký tự, không chứa xuống dòng, ký tự điều khiển hoặc dấu < >.";
    }

    const password =
        typeof body.password === "string" ? body.password : "";

    if (
        [...password].length < 10 ||
        Buffer.byteLength(password, "utf8") > 72 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[\p{P}\p{S}]/u.test(password) ||
        /\s/u.test(password)
    ) {
        errors.password =
            "Mật khẩu từ 10 ký tự, tối đa 72 byte; có chữ hoa, chữ thường, số, ký tự đặc biệt và không có khoảng trắng.";
    }

    if (password !== body.confirmPassword) {
        errors.confirmPassword = "Mật khẩu nhập lại không khớp.";
    }

    if (!data.agreeTerms) {
        errors.agreeTerms = "Bạn cần đồng ý với điều khoản.";
    }

    return { data, errors, password };
}

module.exports = {
    getText,
    validateRegister
};