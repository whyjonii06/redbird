CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS cart_line_items_cart_id_idx ON cart_line_items(cart_id);
CREATE INDEX IF NOT EXISTS stock_levels_variant_id_idx ON stock_levels(variant_id);
CREATE INDEX IF NOT EXISTS order_line_items_order_id_idx ON order_line_items(order_id);
