document.addEventListener("DOMContentLoaded", async () => {
    const province = document.getElementById("province");
    const district = document.getElementById("district");
    const ward = document.getElementById("ward");

    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    const captchaImage = document.getElementById("captchaImage");
    const captchaInput = document.getElementById("captchaInput");
    const refreshCaptcha = document.getElementById("refreshCaptcha");

    function checkConfirmPassword() {
        const mismatch =
            confirmPassword.value &&
            confirmPassword.value !== password.value;

        confirmPassword.setCustomValidity(
            mismatch ? "Mật khẩu nhập lại không khớp." : ""
        );
    }

    password.addEventListener("input", checkConfirmPassword);
    confirmPassword.addEventListener("input", checkConfirmPassword);

    function refreshImage() {
        captchaInput.value = "";
        refreshCaptcha.disabled = true;
        captchaImage.src = `/captcha?t=${Date.now()}`;
    }

    refreshCaptcha.addEventListener("click", refreshImage);

    captchaImage.addEventListener("load", () => {
        refreshCaptcha.disabled = false;
    });

    captchaImage.addEventListener("error", () => {
        refreshCaptcha.disabled = false;
        captchaInput.setCustomValidity(
            "Không tải được mã xác nhận. Hãy nhấn Đổi mã."
        );
    });

    captchaImage.addEventListener("load", () => {
        captchaInput.setCustomValidity("");
    });

    function fillSelect(element, values, placeholder) {
        element.replaceChildren(new Option(placeholder, ""));

        values.forEach(value => {
            element.add(new Option(value, value));
        });
    }

    try {
        const response = await fetch("/address-options");

        if (!response.ok) {
            throw new Error("Không tải được địa chỉ");
        }

        const catalog = await response.json();

        province.addEventListener("change", () => {
            const items = Object.hasOwn(catalog, province.value)
                ? catalog[province.value]
                : {};

            fillSelect(
                district,
                Object.keys(items),
                "Chọn Quận/Huyện"
            );

            fillSelect(ward, [], "Chọn Phường/Xã");
        });

        district.addEventListener("change", () => {
            const items = Object.hasOwn(catalog, province.value)
                ? catalog[province.value]
                : {};

            const wards = Object.hasOwn(items, district.value)
                ? items[district.value]
                : [];

            fillSelect(ward, wards, "Chọn Phường/Xã");
        });
    } catch (error) {
        province.setCustomValidity(
            "Không tải được danh mục địa chỉ. Hãy tải lại trang."
        );
    }
});