document.querySelectorAll("form[data-confirm]").forEach(form => {
    form.addEventListener("submit", event => {
        if (!window.confirm(form.dataset.confirm)) {
            event.preventDefault();
        }
    });
});

const variantRows = document.getElementById("variantRows");

if (variantRows) {
    const stockInput = document.getElementById("stock");
    const stockHelp = document.getElementById("variantStockHelp");
    const stateElement = document.getElementById("variantBuilderState");
    const initialState = JSON.parse(stateElement.textContent || '{"variants":[]}');
    const colorInput = document.getElementById("variantColorInput");
    const sizeInput = document.getElementById("variantSizeInput");
    const colorChips = document.getElementById("variantColorChips");
    const sizeChips = document.getElementById("variantSizeChips");
    const bulkStockInput = document.getElementById("bulkVariantStock");
    const variantCount = document.getElementById("variantCount");
    const variantEmpty = document.getElementById("variantEmpty");
    const variantStatus = document.getElementById("variantBuilderStatus");
    const selectedColors = [];
    const selectedSizes = [];
    let selectionsDirty = false;

    function normalizeVariantValue(value) {
        return value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/gu, "")
            .replace(/[đĐ]/gu, "d")
            .trim()
            .replace(/\s+/gu, " ")
            .toLocaleLowerCase("vi");
    }

    function setVariantStatus(message, isError = false) {
        variantStatus.textContent = message;
        variantStatus.classList.toggle("is-error", isError);
    }

    function addUniqueValue(values, value) {
        const cleanValue = value.trim().replace(/\s+/gu, " ");
        if (!cleanValue) return false;
        if (values.some(item => normalizeVariantValue(item) === normalizeVariantValue(cleanValue))) {
            setVariantStatus(`"${cleanValue}" đã có trong danh sách.`, true);
            return false;
        }
        values.push(cleanValue);
        setVariantStatus("");
        return true;
    }

    function renderChips(values, container, type) {
        container.replaceChildren();

        values.forEach(value => {
            const chip = document.createElement("span");
            chip.className = "variant-chip";

            const text = document.createElement("span");
            text.textContent = value;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "variant-chip-remove";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Xóa ${type} ${value}`);
            remove.addEventListener("click", () => {
                const index = values.indexOf(value);
                if (index !== -1) values.splice(index, 1);
                selectionsDirty = true;
                renderChips(values, container, type);
                if (type === "size") updateSizePresets();
            });

            chip.append(text, remove);
            container.append(chip);
        });
    }

    function addColor() {
        if (addUniqueValue(selectedColors, colorInput.value)) {
            selectionsDirty = true;
            colorInput.value = "";
            renderChips(selectedColors, colorChips, "màu");
            colorInput.focus();
        }
    }

    function addSize(value = sizeInput.value) {
        if (addUniqueValue(selectedSizes, value)) {
            selectionsDirty = true;
            if (value === sizeInput.value) sizeInput.value = "";
            renderChips(selectedSizes, sizeChips, "size");
            updateSizePresets();
            sizeInput.focus();
        }
    }

    function updateSizePresets() {
        document.querySelectorAll(".variant-size-preset").forEach(button => {
            const selected = selectedSizes.some(
                size => normalizeVariantValue(size) === normalizeVariantValue(button.dataset.size)
            );
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    }

    function updateVariantStock() {
        const rows = [...variantRows.querySelectorAll("tr[data-variant-row]")];
        stockInput.readOnly = rows.length > 0;
        stockHelp.textContent = rows.length
            ? "Tổng tồn kho được tính từ các phân loại bên dưới."
            : "Nếu không khai báo phân loại, số lượng này áp dụng cho toàn sản phẩm.";

        if (rows.length > 0) {
            const total = rows.reduce((sum, row) => {
                const value = Number(row.querySelector('[name="variantStock"]').value);
                return sum + (Number.isSafeInteger(value) && value >= 0 ? value : 0);
            }, 0);
            stockInput.value = String(total);
        }

        variantCount.textContent = `${rows.length} phân loại`;
        variantEmpty.hidden = rows.length > 0;
    }

    function appendCell(row, child) {
        const cell = document.createElement("td");
        cell.append(child);
        row.append(cell);
    }

    function appendVariant(variant) {
        const row = document.createElement("tr");
        row.dataset.variantRow = "";
        row.dataset.key = `${normalizeVariantValue(variant.color)}\u0000${normalizeVariantValue(variant.size)}`;

        const id = document.createElement("input");
        id.type = "hidden";
        id.name = "variantId";
        id.value = variant.id || "";

        for (const [index, [field, value]] of [
            [0, ["variantColor", variant.color]],
            [1, ["variantSize", variant.size]]
        ]) {
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.name = field;
            hidden.value = value;
            const text = document.createElement("span");
            text.className = "variant-table-value";
            text.textContent = value;
            const cell = document.createElement("td");
            if (index === 0) cell.append(id);
            cell.append(text, hidden);
            row.append(cell);
        }

        const sku = document.createElement("input");
        sku.className = "variant-table-input";
        sku.name = "variantSku";
        sku.maxLength = 50;
        sku.value = variant.sku || "";
        sku.placeholder = "SKU tùy chọn";
        appendCell(row, sku);

        const stock = document.createElement("input");
        stock.className = "variant-table-input";
        stock.name = "variantStock";
        stock.type = "number";
        stock.min = "0";
        stock.max = "4294967295";
        stock.step = "1";
        stock.value = Number.isInteger(Number(variant.stock)) ? Number(variant.stock) : "0";
        stock.setAttribute("aria-label", `Tồn kho ${variant.color} - ${variant.size}`);
        appendCell(row, stock);

        const remove = document.createElement("button");
        remove.className = "btn small danger";
        remove.type = "button";
        remove.dataset.removeVariant = "";
        remove.textContent = "Xóa";
        remove.setAttribute("aria-label", `Xóa phân loại ${variant.color} - ${variant.size}`);
        appendCell(row, remove);

        variantRows.append(row);
    }

    function readCurrentVariants() {
        return [...variantRows.querySelectorAll("tr[data-variant-row]")].map(row => ({
            id: row.querySelector('[name="variantId"]').value || null,
            color: row.querySelector('[name="variantColor"]').value,
            size: row.querySelector('[name="variantSize"]').value,
            sku: row.querySelector('[name="variantSku"]').value,
            stock: row.querySelector('[name="variantStock"]').value
        }));
    }

    function generateVariants() {
        if (!selectedColors.length || !selectedSizes.length) {
            setVariantStatus("Hãy thêm ít nhất một màu và một size.", true);
            return;
        }

        const total = selectedColors.length * selectedSizes.length;
        if (total > 100) {
            setVariantStatus("Ma trận vượt quá 100 phân loại. Hãy giảm số màu hoặc size.", true);
            return;
        }

        const previous = readCurrentVariants();
        const previousByKey = new Map(
            previous.map(variant => [
                `${normalizeVariantValue(variant.color)}\u0000${normalizeVariantValue(variant.size)}`,
                variant
            ])
        );
        const next = [];
        for (const color of selectedColors) {
            for (const size of selectedSizes) {
                const key = `${normalizeVariantValue(color)}\u0000${normalizeVariantValue(size)}`;
                const existing = previousByKey.get(key);
                next.push(existing
                    ? { ...existing, color, size }
                    : { id: null, color, size, sku: "", stock: bulkStockInput.value || "0" });
            }
        }

        const nextKeys = new Set(next.map(
            variant => `${normalizeVariantValue(variant.color)}\u0000${normalizeVariantValue(variant.size)}`
        ));
        const removed = previous.filter(variant =>
            !nextKeys.has(`${normalizeVariantValue(variant.color)}\u0000${normalizeVariantValue(variant.size)}`)
        );
        if (removed.length > 0 && !window.confirm(
            `Tạo lại ma trận sẽ bỏ ${removed.length} phân loại không còn trong danh sách màu-size. ` +
            "Thông tin các phân loại còn lại sẽ được giữ. Tiếp tục?"
        )) {
            return;
        }

        variantRows.replaceChildren();
        next.forEach(appendVariant);
        selectionsDirty = false;
        updateVariantStock();
        setVariantStatus(`Đã tạo ${next.length} tổ hợp màu-size.`);
    }

    document.getElementById("addVariantColor").addEventListener("click", addColor);
    document.getElementById("addVariantSize").addEventListener("click", () => addSize());
    colorInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            addColor();
        }
    });
    sizeInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            addSize();
        }
    });
    document.querySelectorAll(".variant-size-preset").forEach(button => {
        button.addEventListener("click", () => {
            const existingIndex = selectedSizes.findIndex(
                size => normalizeVariantValue(size) === normalizeVariantValue(button.dataset.size)
            );
            if (existingIndex === -1) {
                addSize(button.dataset.size);
            } else {
                selectedSizes.splice(existingIndex, 1);
                selectionsDirty = true;
                renderChips(selectedSizes, sizeChips, "size");
                updateSizePresets();
            }
        });
    });
    document.getElementById("generateVariants").addEventListener("click", generateVariants);
    document.getElementById("applyBulkVariantStock").addEventListener("click", () => {
        const value = bulkStockInput.value;
        if (!/^(?:0|[1-9]\d{0,9})$/.test(value) || Number(value) > 4294967295) {
            setVariantStatus("Tồn kho hàng loạt phải là số nguyên từ 0 đến 4.294.967.295.", true);
            return;
        }

        variantRows.querySelectorAll('[name="variantStock"]').forEach(input => {
            input.value = value;
        });
        updateVariantStock();
        setVariantStatus("Đã áp dụng tồn kho cho tất cả phân loại.");
    });

    variantRows.addEventListener("click", event => {
        const removeButton = event.target.closest("[data-remove-variant]");
        if (!removeButton) return;

        removeButton.closest("tr[data-variant-row]").remove();
        updateVariantStock();
    });
    variantRows.addEventListener("input", event => {
        if (event.target.name === "variantStock") updateVariantStock();
    });
    document.getElementById("adminEditForm").addEventListener("submit", event => {
        if (selectionsDirty) {
            event.preventDefault();
            setVariantStatus(
                "Danh sách màu hoặc size vừa thay đổi. Hãy nhấn “Tạo phân loại” trước khi lưu.",
                true
            );
        }
    });

    for (const variant of initialState.variants || []) {
        if (!selectedColors.some(color =>
            normalizeVariantValue(color) === normalizeVariantValue(variant.color)
        )) selectedColors.push(variant.color);
        if (!selectedSizes.some(size =>
            normalizeVariantValue(size) === normalizeVariantValue(variant.size)
        )) selectedSizes.push(variant.size);
        appendVariant(variant);
    }
    renderChips(selectedColors, colorChips, "màu");
    renderChips(selectedSizes, sizeChips, "size");
    updateSizePresets();
    updateVariantStock();
}

const imageFile = document.getElementById("imageFile");

if (imageFile) {
    const form = document.getElementById("adminEditForm");
    const imageUrl = document.getElementById("image_url");
    const imagePreview = document.getElementById("imagePreview");
    const imageEmpty = document.getElementById("imageEmpty");
    const uploadStatus = document.getElementById("uploadStatus");
    const saveButton = document.getElementById("saveButton");

    let uploading = false;
    let uploadFailed = false;

    function updatePreview() {
        const value = imageUrl.value.trim();
        let allowed = /^\/(?:uploads\/products|images|img)\//.test(value);

        try {
            if (value) {
                allowed ||= new URL(value).protocol === "https:";
            }
        } catch {
            // Đường dẫn nội bộ đã được kiểm tra phía trên.
        }

        imagePreview.hidden = !value || !allowed;
        imageEmpty.hidden = Boolean(value && allowed);

        if (value && allowed) {
            imagePreview.src = value;
        } else {
            imagePreview.removeAttribute("src");
        }
    }

    imageUrl.addEventListener("input", () => {
        uploadFailed = false;
        updatePreview();
    });

    imagePreview.addEventListener("error", () => {
        imagePreview.hidden = true;
        imageEmpty.hidden = false;
        imageEmpty.textContent = "Không tải được ảnh";
    });

    form.addEventListener("submit", event => {
        if (uploading || uploadFailed) {
            event.preventDefault();

            uploadStatus.textContent = uploading
                ? "Đợi tải ảnh xong rồi lưu."
                : "Ảnh tải lên chưa thành công. Chọn lại ảnh hoặc nhập đường dẫn.";
        }
    });

    imageFile.addEventListener("change", async () => {
        const file = imageFile.files[0];

        if (!file) {
            return;
        }

        uploadFailed = false;

        if (file.size > 3 * 1024 * 1024) {
            uploadFailed = true;
            uploadStatus.textContent = "Ảnh không được vượt quá 3 MB.";
            imageFile.value = "";
            return;
        }

        const data = new FormData();
        data.append("image", file);

        uploading = true;
        const originallyDisabled = saveButton.disabled;

        saveButton.disabled = true;
        imageFile.disabled = true;
        imageUrl.disabled = true;
        uploadStatus.textContent = "Đang tải ảnh...";

        try {
            const response = await fetch("/admin/upload-image", {
                method: "POST",
                headers: {
                    "X-CSRF-Token": form.elements._csrf.value
                },
                body: data
            });

            const isJson = response.headers
                .get("content-type")
                ?.includes("application/json");

            if (!isJson) {
                throw new Error(
                    "Phiên đăng nhập hết hạn hoặc server gặp lỗi. Hãy tải lại trang."
                );
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Không tải được ảnh.");
            }

            imageUrl.value = result.image_url;
            imageEmpty.textContent = "Chưa có ảnh";

            updatePreview();

            uploadStatus.textContent = "Đã tải ảnh. Nhấn lưu để lưu sản phẩm.";
        } catch (error) {
            uploadFailed = true;
            uploadStatus.textContent = error.message;
        } finally {
            uploading = false;
            saveButton.disabled = originallyDisabled;
            imageFile.disabled = false;
            imageUrl.disabled = false;
            imageFile.value = "";
        }
    });
}