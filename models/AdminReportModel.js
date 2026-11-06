const pool = require("../config/database");

const AdminReportModel = {
  async summary(from, to) {
    const params = [from, to];
    const range = `status = 'completed'
            AND created_at >= ?
            AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`;

    const [[summaryRows], [dailyRows], [orderRows]] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) AS completedCount,
                        COALESCE(SUM(total_amount), 0) AS revenue
                 FROM orders WHERE ${range}`,
        params,
      ),
      pool.execute(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS report_date,
            COUNT(*) AS order_count,
            COALESCE(SUM(total_amount), 0) AS revenue
     FROM orders WHERE ${range}
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
     ORDER BY report_date ASC`,
        params,
      ),
      pool.execute(
        `SELECT order_number, customer_name, total_amount, created_at
                 FROM orders WHERE ${range}
                 ORDER BY created_at DESC, id DESC`,
        params,
      ),
    ]);

    return {
      completedCount: Number(summaryRows[0].completedCount),
      revenue: Number(summaryRows[0].revenue),
      dailyRows: dailyRows.map((row) => ({
        date: row.report_date,
        orderCount: Number(row.order_count),
        revenue: Number(row.revenue),
      })),
      orderRows,
    };
  },
};

module.exports = AdminReportModel;
