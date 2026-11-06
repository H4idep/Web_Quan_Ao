const AdminReportModel = require("../models/AdminReportModel");

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function getRange(query) {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = query.from || monthStart;
  const to = query.to || today;

  if (!validDate(from) || !validDate(to) || from > to) {
    const error = new Error(
      "Khoảng thời gian không hợp lệ. Vui lòng chọn lại ngày bắt đầu và ngày kết thúc.",
    );
    error.status = 400;
    throw error;
  }
  return { from, to };
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const AdminReportController = {
  async index(req, res, next) {
    try {
      const { from, to } = getRange(req.query);
      const report = await AdminReportModel.summary(from, to);
      const maxRevenue = Math.max(
        1,
        ...report.dailyRows.map((row) => row.revenue),
      );
      return res.render("admin/reports/index", {
        title: "Báo cáo doanh thu",
        active: "reports",
        from,
        to,
        ...report,
        maxRevenue,
      });
    } catch (error) {
      return next(error);
    }
  },

  async exportExcel(req, res, next) {
    try {
      const { from, to } = getRange(req.query);
      const report = await AdminReportModel.summary(from, to);
      const money = (value) =>
        Number(value).toLocaleString("vi-VN", {
          maximumFractionDigits: 0,
        });

      const rows = report.orderRows
        .map((order, index) => {
          const amount = Math.round(Number(order.total_amount) || 0);

          return `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeXml(order.order_number)}</td>
            <td>${escapeXml(order.customer_name)}</td>
            <td>${escapeXml(new Date(order.created_at).toLocaleString("vi-VN"))}</td>
            <td x:num="${amount}" style="mso-number-format:'#,##0'">${amount}</td>
            <td>Hoàn thành</td>
        </tr>
    `;
        })
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
                <table border="1"><tr><th colspan="6">BÁO CÁO DOANH THU</th></tr>
                <tr><td colspan="6">Từ ngày ${from} đến ngày ${to}</td></tr>
                <tr><th>Tổng doanh thu</th><td>${money(report.revenue)} VNĐ</td><th>Số đơn hoàn thành</th><td>${report.completedCount}</td></tr>
                <tr><th>STT</th><th>Mã đơn hàng</th><th>Khách hàng</th><th>Ngày đặt</th><th>Thành tiền (VNĐ)</th><th>Trạng thái</th></tr>
                ${rows || '<tr><td colspan="6">Không có đơn hàng hoàn thành trong khoảng thời gian này.</td></tr>'}</table></body></html>`;
      const filename = `bao-cao-doanh-thu-${from}-${to}.xls`;
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      return res.send("\uFEFF" + html);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = AdminReportController;
