-- ============================================================
-- Sample data — run after schema.sql to see the app populated.
-- Replace image URLs with your own photos later via the admin panel.
-- ============================================================

insert into menu_items (name, description, price, image_url, category, calories, tags, is_popular) values
('Heart Latte', 'Smooth double espresso with silky steamed milk and delicate latte art.', 4.75 * 83, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress', 'Beverages', 120, '{"Coffee"}', true),
('Artisan Cappuccino', 'Hand-crafted cappuccino with intricate latte art on a wooden table.', 5.00 * 83, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress', 'Beverages', 130, '{"Coffee"}', false),
('Avocado Toast', 'Smashed avocado on sourdough with poached eggs and a drizzle of olive oil.', 8.50 * 83, 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress', 'Breakfast', 310, '{"Vegetarian","Popular"}', true),
('Poached Egg Brunch', 'Poached eggs with avocado and fresh herbs on a light plate.', 9.00 * 83, 'https://images.pexels.com/photos/1109197/pexels-photo-1109197.jpeg?auto=compress', 'Breakfast', 350, '{"Popular"}', true),
('Grilled Chicken Salad', 'Fresh greens with grilled chicken on a wooden platter.', 11.00 * 83, 'https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg?auto=compress', 'Salads', 420, '{"High Protein","Popular"}', true),
('Mediterranean Plate', 'Boiled eggs, grilled halloumi, and fresh garden vegetables.', 10.50 * 83, 'https://images.pexels.com/photos/1105325/pexels-photo-1105325.jpeg?auto=compress', 'Salads', 380, '{"Vegetarian"}', false),
('Classic Cheeseburger', 'Juicy beef patty with melted cheese and crisp lettuce.', 12.50 * 83, 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress', 'Mains', 650, '{"Bestseller"}', true),
('Gourmet Burger', 'Stacked burger with bacon, cheese, and fresh lettuce.', 13.50 * 83, 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress', 'Mains', 780, '{"Premium"}', true),
('Crispy French Fries', 'Golden crispy fries seasoned with sea salt.', 4.00 * 83, 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress', 'Snacks', 310, '{"Snack"}', true),
('Berry Streusel Slice', 'Crumbly berry streuselkuchen served on a black plate.', 5.50 * 83, 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress', 'Desserts', 290, '{"Sweet"}', true),
('Herbal Wellness Tea', 'A soothing blend of herbal tea, perfect after any meal.', 3.50 * 83, 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress', 'Beverages', 5, '{"Wellness"}', false);

insert into inventory_items (name, quantity, unit, min_level, cost_per_unit) values
('Avocado', 24, 'pcs', 10, 65),
('Chicken Breast', 6, 'kg', 3, 620),
('Coffee Beans', 12, 'kg', 5, 1490),
('Eggs', 8, 'dozen', 3, 210),
('Flour', 15, 'kg', 5, 75),
('Fresh Milk', 30, 'L', 10, 100);

insert into staff (name, role, phone, email, shift, monthly_salary) values
('Maria Lopez', 'Head Chef', '+91 90000 00101', 'maria@saffronsage.cafe', 'Morning', 32000),
('James Carter', 'Barista', '+91 90000 00102', 'james@saffronsage.cafe', 'Morning', 22000),
('Priya Sharma', 'Server', '+91 90000 00103', 'priya@saffronsage.cafe', 'Evening', 18000),
('David Kim', 'Kitchen Staff', '+91 90000 00104', 'david@saffronsage.cafe', 'Evening', 19000),
('Sofia Rossi', 'Manager', '+91 90000 00105', 'sofia@saffronsage.cafe', 'Morning', 35000);

insert into discounts (code, type, value, min_order_value, valid_from, valid_to) values
('WELCOME10', 'percent', 10, 200, current_date, current_date + interval '90 days'),
('FLAT50', 'flat', 50, 500, current_date, current_date + interval '30 days');

update cafe_settings set
  cafe_name = 'Saffron & Sage',
  tagline = 'Eat Healthy, Stay Healthy',
  hero_image_url = 'https://images.pexels.com/photos/972845/pexels-photo-972845.jpeg?auto=compress',
  about_text = 'A cozy cafe serving wholesome, freshly prepared meals made from locally sourced ingredients. Our mission is simple: nourish your body, delight your taste buds, and make every visit feel like home.',
  phone = '+91 98765 43210',
  email = 'hello@saffronsage.cafe',
  address = '123 Garden Street, Green Valley'
where id = 1;
