document.addEventListener("DOMContentLoaded", async () => {
    const province = document.getElementById("province");
    const ward = document.getElementById("ward");
    const addressLoadError = document.getElementById("addressLoadError");

    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    const captchaImage = document.getElementById("captchaImage");
    const captchaInput = document.getElementById("captchaInput");
    const refreshCaptcha = document.getElementById("refreshCaptcha");

    function checkConfirmPassword() {
        const mismatch =
            confirmPassword.value !== ""
            && confirmPassword.value !== password.value;

        confirmPassword.setCustomValidity(
            mismatch ? "Mật khẩu nhập lại không khớp." : ""
        );
    }

    password.addEventListener("input", checkConfirmPassword);
    confirmPassword.addEventListener("input", checkConfirmPassword);

    refreshCaptcha.addEventListener("click", () => {
        captchaInput.value = "";
        refreshCaptcha.disabled = true;
        captchaImage.src = `/captcha?t=${Date.now()}`;
    });

    captchaImage.addEventListener("load", () => {
        refreshCaptcha.disabled = false;
        captchaInput.setCustomValidity("");
    });

    captchaImage.addEventListener("error", () => {
        refreshCaptcha.disabled = false;

        captchaInput.setCustomValidity(
            "Không tải được mã xác nhận. Hãy nhấn Đổi mã."
        );
    });

    function fillWards(values, selectedValue = "") {
        ward.replaceChildren(
            new Option("Chọn Phường/Xã/Đặc khu", "")
        );

        for (const value of values) {
            ward.add(new Option(value, value));
        }

        ward.value = values.includes(selectedValue)
            ? selectedValue
            : "";

        ward.disabled = values.length === 0;
    }

    // Ghi lại lựa chọn mà server trả về khi đăng ký gặp lỗi.
    const savedWard = ward.value;
    let catalog = null;

    province.setCustomValidity("Đang tải danh mục địa chỉ.");
    ward.disabled = true;

    province.addEventListener("change", () => {
        const values = catalog
            && Object.hasOwn(catalog, province.value)
                ? catalog[province.value]
                : [];

        // Đổi tỉnh thì bỏ lựa chọn xã của tỉnh trước.
        fillWards(values);
    });

    try {
        // Đây là endpoint của website, không gọi API bên ngoài.
        const response = await fetch("/address-options", {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error("Không tải được danh mục địa chỉ.");
        }

        const result = await response.json();

        if (
            !result
            || typeof result !== "object"
            || Array.isArray(result)
            || Object.keys(result).length === 0
            || Object.values(result).some(
                values => !Array.isArray(values)
                    || values.some(value => typeof value !== "string")
            )
        ) {
            throw new Error("Danh mục địa chỉ không đúng định dạng.");
        }

        catalog = result;

        const values = Object.hasOwn(catalog, province.value)
            ? catalog[province.value]
            : [];

        fillWards(values, savedWard);
        province.setCustomValidity("");
        addressLoadError.textContent = "";
    } catch (error) {
        const message =
            "Không tải được danh mục địa chỉ. Vui lòng tải lại trang.";

        province.setCustomValidity(message);
        addressLoadError.textContent = message;
        ward.disabled = true;
    }
});