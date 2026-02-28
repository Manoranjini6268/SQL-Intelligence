const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'localhost',user:'root',password:'password',database:'ecommerce'});
  const [rows] = await c.query(`
    SELECT p.name, p.sku, oi.quantity, oi.unit_price,
           o.order_number, o.status, DATE(o.ordered_at) AS ordered_date
    FROM customers cu
    JOIN orders o ON o.customer_id = cu.id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE cu.first_name = 'Maria' AND cu.last_name = 'Garcia'
    ORDER BY o.ordered_at DESC
  `);
  console.table(rows);
  console.log(`\nTotal items: ${rows.length}`);
  await c.end();
})();
