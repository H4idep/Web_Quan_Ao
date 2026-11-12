(() => {
    const notice = document.getElementById("couponNotice");

    function showNotice(message, type = "error") {
        if (!notice) return;
        notice.textContent = message;
        notice.className = `alert ${type}`;
        notice.hidden = false;
        notice.focus?.();
    }

    function clearFieldErrors() {
        document.querySelectorAll("[data-coupon-error]").forEach(element => {
            element.textContent = "";
        });
    }

    function showFieldErrors(errors) {
        clearFieldErrors();
        Object.entries(errors || {}).forEach(([name, message]) => {
            const target = document.querySelector(`[data-coupon-error="${CSS.escape(name)}"]`);
            if (target) target.textContent = message;
        });
    }

    async function sendForm(form, method) {
        const token = form.querySelector('[name="_csrf"]')?.value || "";
        const headers = {
            "X-CSRF-Token": token,
            "Accept": "application/json"
        };
        const options = { method, headers };

        if (method === "PUT") {
            headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
            options.body = new URLSearchParams(new FormData(form)).toString();
        }

        const response = await fetch(form.action, options);
        const raw = await response.text();
        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = { message: raw || "Không thể hoàn tất yêu cầu." };
        }

        if (!response.ok) {
            showFieldErrors(payload.errors);
            showNotice(payload.message || "Yêu cầu không thành công.");
            return false;
        }

        if (method === "PUT") {
            window.location.assign("/admin/coupons");
            return true;
        }

        window.location.reload();
        return true;
    }

    document.querySelectorAll("form[data-api-method]").forEach(form => {
        form.addEventListener("submit", async event => {
            if (event.defaultPrevented) return;
            event.preventDefault();

            const method = form.dataset.apiMethod;
            if (method === "PUT") {
                clearFieldErrors();
                if (!form.reportValidity()) return;
                const code = form.querySelector('[name="code"]');
                code.value = code.value.normalize("NFC").toLocaleUpperCase("vi").replace(/\s+/gu, "");
                const start = form.querySelector('[name="start_date"]');
                const end = form.querySelector('[name="end_date"]');
                if (start.value && end.value && end.value <= start.value) {
                    end.setCustomValidity("Ngày kết thúc phải sau ngày bắt đầu.");
                    end.reportValidity();
                    end.setCustomValidity("");
                    return;
                }
            }

            try {
                await sendForm(form, method);
            } catch {
                showNotice("Không thể kết nối máy chủ. Vui lòng thử lại.");
            }
        });
    });

    const form = document.getElementById("couponForm");
    if (!form) return;

    const code = form.querySelector('[name="code"]');
    const type = form.querySelector('[name="discount_type"]');
    const value = form.querySelector('[name="discount_value"]');
    const cap = form.querySelector('[name="max_discount_amount"]');

    code.addEventListener("blur", () => {
        code.value = code.value.normalize("NFC").toLocaleUpperCase("vi").replace(/\s+/gu, "");
    });

    form.addEventListener("submit", event => {
        code.value = code.value.normalize("NFC").toLocaleUpperCase("vi").replace(/\s+/gu, "");
        const start = form.querySelector('[name="start_date"]');
        const end = form.querySelector('[name="end_date"]');
        if (start.value && end.value && end.value <= start.value) {
            event.preventDefault();
            end.setCustomValidity("Ngày kết thúc phải sau ngày bắt đầu.");
            end.reportValidity();
            end.setCustomValidity("");
        }
    });

    function updateTypeFields() {
        const percent = type.value === "percentage";
        value.max = percent ? "100" : "9999999999.99";
        cap.disabled = !percent;
        if (!percent) cap.value = "";
    }
    type.addEventListener("change", updateTypeFields);
    updateTypeFields();
})();
