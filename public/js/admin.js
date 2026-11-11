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

(() => {
    const sidebar = document.getElementById("adminSidebar");
    const menuToggle = document.querySelector(".menu-toggle");
    const sidebarBackdrop = document.querySelector(".sidebar-backdrop");
    const adminSearch = document.querySelector(".admin-search input");
    const searchToggle = document.querySelector(".search-toggle");
    const adminSearchForm = document.querySelector(".admin-search");

    function setSidebarOpen(isOpen) {
        if (!sidebar || !menuToggle || !sidebarBackdrop) return;

        sidebar.classList.toggle("is-open", isOpen);
        sidebarBackdrop.classList.toggle("is-visible", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Đóng điều hướng" : "Mở điều hướng");
        document.body.classList.toggle("sidebar-open", isOpen);

        if (isOpen) {
            sidebar.querySelector("nav a")?.focus();
        } else {
            menuToggle.focus();
        }
    }

    menuToggle?.addEventListener("click", () => {
        setSidebarOpen(menuToggle.getAttribute("aria-expanded") !== "true");
    });

    sidebarBackdrop?.addEventListener("click", () => setSidebarOpen(false));
    sidebar?.querySelectorAll("nav a").forEach(link => {
        link.addEventListener("click", () => {
            if (menuToggle?.getAttribute("aria-expanded") === "true") setSidebarOpen(false);
        });
    });

    searchToggle?.addEventListener("click", () => {
        adminSearchForm?.classList.add("is-open");
        adminSearch?.focus();
    });

    adminSearch?.addEventListener("focus", () => adminSearchForm?.classList.add("is-open"));

    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            adminSearchForm?.classList.add("is-open");
            adminSearch?.focus();
        }

        if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
            setSidebarOpen(false);
        }

        if (event.key === "Escape" && adminSearchForm?.classList.contains("is-open")) {
            adminSearchForm.classList.remove("is-open");
            adminSearch?.blur();
            searchToggle?.focus();
        }
    });

    window.matchMedia("(min-width: 901px)").addEventListener?.("change", event => {
        if (event.matches && menuToggle?.getAttribute("aria-expanded") === "true") {
            sidebar?.classList.remove("is-open");
            sidebarBackdrop?.classList.remove("is-visible");
            menuToggle.setAttribute("aria-expanded", "false");
            document.body.classList.remove("sidebar-open");
        }
    });

    const chart = document.getElementById("revenueChart");

    if (chart) {
        const renderRevenueChart = () => {
        const svgNamespace = "http://www.w3.org/2000/svg";
        const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
        const compactFormat = new Intl.NumberFormat("vi-VN", {
            notation: "compact",
            maximumFractionDigits: 1
        });
        const dateFormat = new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
        const points = [];

        document.querySelectorAll(".recent-orders-table tbody tr[data-order-status='completed']").forEach(row => {
            const date = new Date(row.dataset.orderDate);
            const amount = Number(row.dataset.orderAmount);
            if (Number.isNaN(date.getTime()) || !Number.isFinite(amount)) return;
            points.push({ date, amount });
        });

        points.sort((first, second) => first.date - second.date);
        const total = points.reduce((sum, point) => sum + point.amount, 0);
        const totalElement = document.getElementById("recentRevenueTotal");
        const status = document.getElementById("revenueChartStatus");

        if (totalElement) totalElement.textContent = `${numberFormat.format(total)} đ`;
        if (points.length === 0) {
            const empty = document.createElement("div");
            empty.className = "chart-empty";

            const icon = document.createElementNS(svgNamespace, "svg");
            icon.setAttribute("viewBox", "0 0 24 24");
            icon.setAttribute("fill", "none");
            icon.setAttribute("stroke", "currentColor");
            icon.setAttribute("stroke-width", "1.5");
            icon.setAttribute("aria-hidden", "true");
            const path = document.createElementNS(svgNamespace, "path");
            path.setAttribute("d", "M4 19V5m0 14h17M7 15l4-4 3 2 6-7");
            icon.append(path);

            const title = document.createElement("strong");
            title.textContent = "Chưa có doanh thu hoàn thành";
            const description = document.createElement("span");
            description.textContent = "Biểu đồ sẽ cập nhật khi có đơn hàng hoàn thành trong danh sách gần đây.";
            empty.append(icon, title, description);
            chart.append(empty);
            if (status) status.textContent = title.textContent;
            return;
        }

        const width = 680;
        const height = 220;
        const margin = { top: 14, right: 12, bottom: 34, left: 58 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        const maxValue = Math.max(1, ...points.map(point => point.amount));
        const tickCount = 4;
        const svg = document.createElementNS(svgNamespace, "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `Doanh thu ${points.length} đơn hoàn thành trong 5 đơn gần nhất`);

        const defs = document.createElementNS(svgNamespace, "defs");
        const gradient = document.createElementNS(svgNamespace, "linearGradient");
        gradient.setAttribute("id", "revenueArea");
        gradient.setAttribute("x1", "0");
        gradient.setAttribute("x2", "0");
        gradient.setAttribute("y1", "0");
        gradient.setAttribute("y2", "1");
        const stopTop = document.createElementNS(svgNamespace, "stop");
        stopTop.setAttribute("offset", "0%");
        stopTop.setAttribute("stop-color", "#4b9468");
        stopTop.setAttribute("stop-opacity", ".18");
        const stopBottom = document.createElementNS(svgNamespace, "stop");
        stopBottom.setAttribute("offset", "100%");
        stopBottom.setAttribute("stop-color", "#4b9468");
        stopBottom.setAttribute("stop-opacity", "0");
        gradient.append(stopTop, stopBottom);
        defs.append(gradient);
        svg.append(defs);

        const createSvgElement = (name, attributes, text) => {
            const element = document.createElementNS(svgNamespace, name);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            if (text) element.textContent = text;
            return element;
        };

        for (let index = 0; index <= tickCount; index += 1) {
            const y = margin.top + (plotHeight * index) / tickCount;
            const value = maxValue * (1 - index / tickCount);
            svg.append(
                createSvgElement("line", {
                    x1: margin.left,
                    x2: width - margin.right,
                    y1: y,
                    y2: y,
                    class: "chart-grid-line"
                }),
                createSvgElement("text", {
                    x: margin.left - 9,
                    y: y + 3,
                    "text-anchor": "end",
                    class: "chart-axis-label"
                }, compactFormat.format(value))
            );
        }

        const getX = index => points.length === 1
            ? margin.left + plotWidth / 2
            : margin.left + (plotWidth * index) / (points.length - 1);
        const getY = amount => margin.top + plotHeight * (1 - amount / maxValue);
        const pathData = points.map((point, index) =>
            `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(point.amount)}`
        ).join(" ");

        if (points.length > 1) {
            svg.append(createSvgElement("path", {
                d: `${pathData} L ${getX(points.length - 1)} ${margin.top + plotHeight} L ${getX(0)} ${margin.top + plotHeight} Z`,
                class: "chart-area"
            }));
        }

        svg.append(createSvgElement("path", { d: pathData, class: "chart-line" }));

        points.forEach((point, index) => {
            const label = `${point.date.toLocaleString("vi-VN")}: ${numberFormat.format(point.amount)} đ`;
            const circle = createSvgElement("circle", {
                cx: getX(index),
                cy: getY(point.amount),
                r: 4,
                class: "chart-point",
                tabindex: 0,
                "aria-label": label
            });
            const title = createSvgElement("title", {}, label);
            circle.append(title);
            svg.append(circle);
            svg.append(createSvgElement("text", {
                x: getX(index),
                y: height - 11,
                "text-anchor": "middle",
                class: "chart-axis-label"
            }, dateFormat.format(point.date)));
        });

        chart.append(svg);
        if (status) status.textContent = `Biểu đồ gồm ${points.length} đơn hoàn thành, tổng ${numberFormat.format(total)} đồng.`;
        };

        renderRevenueChart();
    }

    document.querySelectorAll(".relative-time").forEach(element => {
        const date = new Date(element.dateTime);
        if (Number.isNaN(date.getTime())) return;

        const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        let relative;

        if (minutes < 1) relative = "Vừa xong";
        else if (minutes < 60) relative = `${minutes} phút trước`;
        else if (hours < 24) relative = `${hours} giờ trước`;
        else if (days < 7) relative = `${days} ngày trước`;
        else relative = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

        element.textContent = relative;
    });
})();