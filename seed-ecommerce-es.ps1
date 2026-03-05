#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════
# Elasticsearch Ecommerce Seed Script
# Creates 4 denormalized indices from ecommerce SQL data model:
#   1. product_catalog   — enriched products with category/brand/inventory/reviews
#   2. order_analytics   — denormalized orders with customer/items/payment info
#   3. customer_insights — customer behavior & lifetime value metrics
#   4. daily_sales       — time-series aggregated daily sales
# ═══════════════════════════════════════════════════════════════

$ES = "http://localhost:9200"

Write-Host "`n=== Ecommerce ES Seed ===" -ForegroundColor Cyan

# ── Delete old indices ──────────────────────────
Write-Host "Deleting old indices..." -ForegroundColor Yellow
foreach ($idx in @("products","orders","logs","product_catalog","order_analytics","customer_insights","daily_sales")) {
  try { Invoke-RestMethod -Method DELETE "$ES/$idx" -ErrorAction SilentlyContinue | Out-Null } catch {}
}

# ══════════════════════════════════════════════════
# 1. PRODUCT_CATALOG INDEX
# ══════════════════════════════════════════════════
Write-Host "`n[1/4] Creating product_catalog index..." -ForegroundColor Green

$productMapping = @"
{
  "mappings": {
    "properties": {
      "product_id": { "type": "integer" },
      "sku": { "type": "keyword" },
      "name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "description": { "type": "text" },
      "category": { "type": "keyword" },
      "parent_category": { "type": "keyword" },
      "brand": { "type": "keyword" },
      "price": { "type": "float" },
      "compare_at_price": { "type": "float" },
      "cost_price": { "type": "float" },
      "margin_percent": { "type": "float" },
      "weight_kg": { "type": "float" },
      "is_active": { "type": "boolean" },
      "is_featured": { "type": "boolean" },
      "stock_quantity": { "type": "integer" },
      "reserved": { "type": "integer" },
      "warehouse_location": { "type": "keyword" },
      "avg_rating": { "type": "float" },
      "review_count": { "type": "integer" },
      "total_sold": { "type": "integer" },
      "revenue": { "type": "float" },
      "created_at": { "type": "date" }
    }
  }
}
"@
Invoke-RestMethod -Method PUT "$ES/product_catalog" -ContentType "application/json" -Body $productMapping | Out-Null

# Product data (150 products from ecommerce_seed.sql)
$categories = @{
  2="Computers & Laptops"; 3="Smartphones"; 4="Audio"; 5="Cameras";
  7="Men's Clothing"; 8="Women's Clothing"; 9="Kids' Clothing";
  11="Furniture"; 12="Kitchen"; 13="Decor";
  15="Fitness"; 16="Cycling"; 17="Camping";
  19="Fiction"; 20="Non-Fiction"; 21="Tech Books";
  23="Skincare"; 24="Supplements"; 25="Toys & Games"
}
$parentCategories = @{
  2="Electronics"; 3="Electronics"; 4="Electronics"; 5="Electronics";
  7="Clothing"; 8="Clothing"; 9="Clothing";
  11="Home & Garden"; 12="Home & Garden"; 13="Home & Garden";
  15="Sports & Outdoors"; 16="Sports & Outdoors"; 17="Sports & Outdoors";
  19="Books"; 20="Books"; 21="Books";
  23="Health & Beauty"; 24="Health & Beauty"; 25="Toys & Games"
}
$brands = @{
  1="TechPro"; 2="Zenith Electronics"; 3="UrbanStyle"; 4="HomeNest"; 5="FitLife";
  6="PageTurn"; 7="NaturGlow"; 8="SwiftGear"; 9="PixelCraft"; 10="SoundWave";
  11="Apex Outdoors"; 12="KidZone"; 13="GreenLeaf"; 14="EliteCook"; 15="ByteBooks"
}

# Product definitions: id, sku, name, desc, cat_id, brand_id, price, compare_price, cost_price, weight, is_featured
$products = @(
  @(1,"COMP-001","ProBook Laptop 15in","High-performance laptop 16GB RAM 512GB SSD",2,1,1299.99,1499.99,899.99,2.1,1),
  @(2,"COMP-002","UltraSlim Laptop 13in","Ultra-thin laptop for professionals",2,2,999.99,1199.99,699.99,1.4,1),
  @(3,"COMP-003","Gaming Desktop Tower","High-end gaming PC with RTX graphics",2,1,1899.99,2199.99,1399.99,12.0,1),
  @(4,"COMP-004","Mini PC Compact","Space-saving mini desktop computer",2,2,549.99,649.99,379.99,0.8,0),
  @(5,"COMP-005","Business Workstation","Enterprise-grade workstation",2,1,2499.99,2899.99,1799.99,15.0,0),
  @(6,"PHONE-001","Galaxy Ultra X","Flagship smartphone 200MP camera",3,2,1199.99,1299.99,799.99,0.23,1),
  @(7,"PHONE-002","PixelPro 8","Pure Android with AI features",3,1,899.99,999.99,599.99,0.2,1),
  @(8,"PHONE-003","Budget Phone SE","Affordable smartphone",3,2,299.99,349.99,179.99,0.19,0),
  @(9,"PHONE-004","Foldable Flip Z","Innovative foldable smartphone",3,2,1499.99,1699.99,999.99,0.27,1),
  @(10,"PHONE-005","Phone Mini 6in","Compact flagship phone",3,1,749.99,849.99,499.99,0.17,0),
  @(11,"AUDIO-001","NoiseCancel Pro Headphones","Premium wireless ANC headphones",4,10,349.99,399.99,199.99,0.26,1),
  @(12,"AUDIO-002","EarBuds Ultra","True wireless earbuds spatial audio",4,10,199.99,249.99,109.99,0.055,1),
  @(13,"AUDIO-003","Portable Speaker Boom","Waterproof Bluetooth speaker",4,10,129.99,159.99,69.99,0.68,0),
  @(14,"AUDIO-004","Studio Monitor Pair","Professional studio monitors",4,10,599.99,699.99,399.99,8.5,0),
  @(15,"AUDIO-005","Soundbar Home Theater","Dolby Atmos soundbar",4,10,449.99,549.99,299.99,4.2,1),
  @(16,"CAM-001","DSLR Pro Mark IV","Professional full-frame DSLR",5,9,2799.99,3199.99,1899.99,1.1,1),
  @(17,"CAM-002","Mirrorless Alpha 7","Compact mirrorless 4K video",5,9,1999.99,2299.99,1399.99,0.65,1),
  @(18,"CAM-003","Action Cam Hero","Waterproof 5K action camera",5,9,399.99,449.99,249.99,0.15,0),
  @(19,"CAM-004","Instant Print Camera","Fun instant print camera",5,9,89.99,109.99,49.99,0.3,0),
  @(20,"CAM-005","Drone SkyView Pro","4K aerial photography drone",5,9,899.99,1099.99,599.99,0.9,1),
  @(21,"MCLOTH-001","Classic Fit Oxford Shirt","Premium cotton oxford shirt",7,3,59.99,79.99,24.99,0.3,0),
  @(22,"MCLOTH-002","Slim Chino Pants","Stretch chino trousers",7,3,49.99,69.99,19.99,0.45,0),
  @(23,"MCLOTH-003","Leather Bomber Jacket","Genuine leather bomber",7,3,299.99,399.99,149.99,1.8,1),
  @(24,"MCLOTH-004","Merino Wool Sweater","Fine merino crew neck",7,3,89.99,119.99,39.99,0.35,0),
  @(25,"MCLOTH-005","Tailored Suit 2-Piece","Modern fit wool blend suit",7,3,399.99,549.99,199.99,2.2,1),
  @(26,"MCLOTH-006","Casual Denim Jeans","Relaxed fit denim jeans",7,3,69.99,89.99,29.99,0.7,0),
  @(27,"MCLOTH-007","Performance Polo","Moisture-wicking polo",7,3,44.99,54.99,18.99,0.25,0),
  @(28,"MCLOTH-008","Quilted Vest","Lightweight quilted vest",7,3,79.99,99.99,34.99,0.4,0),
  @(29,"WCLOTH-001","Silk Wrap Dress","Elegant silk wrap dress",8,3,149.99,199.99,69.99,0.35,1),
  @(30,"WCLOTH-002","High-Rise Skinny Jeans","Stretchy high-rise jeans",8,3,79.99,99.99,34.99,0.6,0),
  @(31,"WCLOTH-003","Cashmere Cardigan","Soft cashmere button cardigan",8,3,199.99,269.99,89.99,0.4,1),
  @(32,"WCLOTH-004","Trench Coat Classic","Double-breasted trench coat",8,3,249.99,329.99,119.99,1.5,0),
  @(33,"WCLOTH-005","Yoga Leggings Pro","High-waist compression leggings",8,5,59.99,74.99,24.99,0.25,0),
  @(34,"WCLOTH-006","Linen Blouse","Breathable linen top",8,3,54.99,69.99,22.99,0.2,0),
  @(35,"WCLOTH-007","Pleated Midi Skirt","Flowing pleated skirt",8,3,69.99,89.99,29.99,0.35,0),
  @(36,"KCLOTH-001","Kids Rainbow T-Shirt","Colorful cotton tshirt",9,12,19.99,24.99,7.99,0.15,0),
  @(37,"KCLOTH-002","Junior Denim Overalls","Durable denim overalls",9,12,34.99,44.99,14.99,0.4,0),
  @(38,"KCLOTH-003","Winter Puffer Jacket Kids","Warm puffer for cold days",9,12,59.99,79.99,24.99,0.6,0),
  @(39,"FURN-001","Mid-Century Sofa","Three-seater mid-century sofa",11,4,1299.99,1599.99,699.99,45.0,1),
  @(40,"FURN-002","Ergonomic Office Chair","Adjustable lumbar support chair",11,4,499.99,599.99,249.99,15.0,1),
  @(41,"FURN-003","Solid Oak Dining Table","6-person solid oak table",11,4,899.99,1099.99,499.99,35.0,0),
  @(42,"FURN-004","King Platform Bed Frame","Modern platform bed",11,4,699.99,899.99,349.99,40.0,0),
  @(43,"FURN-005","Floating Bookshelf Set","Set of 3 floating shelves",11,4,79.99,99.99,34.99,3.5,0),
  @(44,"FURN-006","Standing Desk Electric","Height-adjustable electric desk",11,4,649.99,799.99,349.99,28.0,1),
  @(45,"KITCH-001","Stainless Steel Cookware Set","12-piece professional cookware",12,14,299.99,399.99,149.99,8.5,1),
  @(46,"KITCH-002","Smart Blender Pro","Programmable high-speed blender",12,14,179.99,219.99,89.99,3.2,0),
  @(47,"KITCH-003","Espresso Machine Deluxe","Semi-automatic espresso maker",12,14,449.99,549.99,249.99,6.5,1),
  @(48,"KITCH-004","Knife Block Set Chef","8-piece forged knife set",12,14,199.99,249.99,99.99,2.8,0),
  @(49,"KITCH-005","Air Fryer XL","Large capacity digital air fryer",12,14,129.99,159.99,64.99,5.2,0),
  @(50,"KITCH-006","Cast Iron Dutch Oven","6-quart enameled dutch oven",12,14,89.99,109.99,44.99,5.8,0),
  @(51,"DECOR-001","Artisan Table Lamp","Hand-blown glass table lamp",13,4,129.99,159.99,59.99,2.1,0),
  @(52,"DECOR-002","Woven Area Rug 8x10","Handwoven wool area rug",13,4,349.99,449.99,179.99,8.0,0),
  @(53,"DECOR-003","Ceramic Vase Collection","Set of 3 modern ceramic vases",13,4,69.99,89.99,29.99,1.8,0),
  @(54,"DECOR-004","Wall Art Canvas 3-Panel","Abstract triptych wall art",13,4,159.99,199.99,69.99,3.0,0),
  @(55,"DECOR-005","Scented Candle Gift Set","6-piece soy wax candle set",13,13,49.99,64.99,19.99,1.5,0),
  @(56,"FIT-001","Smart Treadmill X1","Connected folding treadmill",15,5,1299.99,1599.99,799.99,55.0,1),
  @(57,"FIT-002","Adjustable Dumbbell Set","5-50lb adjustable dumbbells pair",15,5,399.99,499.99,199.99,25.0,1),
  @(58,"FIT-003","Yoga Mat Premium","Extra-thick eco-friendly mat",15,5,49.99,64.99,19.99,1.2,0),
  @(59,"FIT-004","Resistance Bands Kit","Set of 5 resistance bands",15,5,29.99,39.99,9.99,0.5,0),
  @(60,"FIT-005","Fitness Tracker Band","Heart rate and sleep tracker",15,5,79.99,99.99,34.99,0.035,0),
  @(61,"FIT-006","Kettlebell Set Cast Iron","Set of 3 kettlebells",15,5,149.99,189.99,79.99,30.0,0),
  @(62,"CYCLE-001","Road Bike Carbon","Lightweight carbon road bike",16,8,2499.99,2999.99,1699.99,8.2,1),
  @(63,"CYCLE-002","Mountain Bike Trail","Full-suspension mountain bike",16,8,1899.99,2299.99,1299.99,13.5,0),
  @(64,"CYCLE-003","E-Bike Commuter","Electric city commuter bike",16,8,1599.99,1899.99,999.99,22.0,1),
  @(65,"CYCLE-004","Bike Helmet Aero","Aerodynamic cycling helmet",16,8,129.99,159.99,59.99,0.25,0),
  @(66,"CYCLE-005","Cycling Jersey Pro","Breathable cycling jersey",16,8,69.99,89.99,29.99,0.18,0),
  @(67,"CAMP-001","4-Person Tent Dome","Waterproof dome camping tent",17,11,199.99,249.99,99.99,3.5,0),
  @(68,"CAMP-002","Sleeping Bag -20F","Extreme cold sleeping bag",17,11,149.99,189.99,74.99,2.2,0),
  @(69,"CAMP-003","Hiking Backpack 65L","Large capacity hiking pack",17,11,179.99,219.99,89.99,1.8,1),
  @(70,"CAMP-004","Portable Camping Stove","Compact propane camp stove",17,11,59.99,74.99,29.99,1.1,0),
  @(71,"CAMP-005","LED Lantern Rechargeable","USB-C rechargeable lantern",17,11,34.99,44.99,14.99,0.35,0),
  @(72,"BOOK-F01","The Last Algorithm","Thriller novel about AI",19,6,16.99,19.99,5.99,0.4,0),
  @(73,"BOOK-F02","Ocean of Stars","Sci-fi spanning galaxies",19,6,14.99,17.99,4.99,0.38,0),
  @(74,"BOOK-F03","Midnight Garden","Mystery romance novel",19,6,13.99,16.99,4.49,0.35,0),
  @(75,"BOOK-F04","The Forgotten City","Historical fiction adventure",19,6,15.99,18.99,5.49,0.42,0),
  @(76,"BOOK-F05","Echoes of Tomorrow","Time travel literary fiction",19,6,17.99,21.99,6.49,0.4,1),
  @(77,"BOOK-N01","Atomic Habits of Leaders","Leadership and productivity",20,6,24.99,29.99,8.99,0.55,1),
  @(78,"BOOK-N02","The Data Economy","How data shapes business",20,6,22.99,27.99,7.99,0.5,0),
  @(79,"BOOK-N03","Mindful Living","Guide to mindfulness",20,6,19.99,24.99,6.99,0.4,0),
  @(80,"BOOK-N04","Climate Solutions","Practical climate approaches",20,6,21.99,26.99,7.49,0.48,0),
  @(81,"BOOK-T01","Modern SQL Mastery","Advanced SQL techniques",21,15,44.99,54.99,14.99,0.8,1),
  @(82,"BOOK-T02","Cloud Architecture Patterns","Scalable cloud systems",21,15,49.99,59.99,16.99,0.85,0),
  @(83,"BOOK-T03","Rust Programming Handbook","Complete Rust guide",21,15,39.99,49.99,12.99,0.75,0),
  @(84,"BOOK-T04","AI/ML Engineering","Practical ML engineering",21,15,54.99,64.99,18.99,0.9,1),
  @(85,"BOOK-T05","TypeScript Deep Dive","Advanced TypeScript patterns",21,15,42.99,52.99,13.99,0.78,0),
  @(86,"SKIN-001","Vitamin C Serum","Brightening vitamin C 30ml",23,7,34.99,44.99,12.99,0.1,1),
  @(87,"SKIN-002","Hyaluronic Acid Moisturizer","Deep hydration cream 50ml",23,7,29.99,39.99,10.99,0.12,0),
  @(88,"SKIN-003","Retinol Night Cream","Anti-aging retinol 50ml",23,7,39.99,49.99,14.99,0.13,0),
  @(89,"SKIN-004","Sunscreen SPF 50","Mineral sunscreen",23,7,24.99,29.99,8.99,0.15,0),
  @(90,"SKIN-005","Facial Cleansing Kit","3-step cleansing system",23,7,49.99,64.99,19.99,0.4,0),
  @(91,"SUPP-001","Multivitamin Complete","Daily multivitamin 90 caps",24,13,24.99,29.99,8.99,0.2,0),
  @(92,"SUPP-002","Omega-3 Fish Oil","High-potency omega-3 120",24,13,19.99,24.99,6.99,0.3,0),
  @(93,"SUPP-003","Protein Powder Whey","Vanilla whey protein 2lb",24,13,39.99,49.99,14.99,1.0,0),
  @(94,"SUPP-004","Collagen Peptides","Type I III collagen powder",24,13,29.99,34.99,10.99,0.4,0),
  @(95,"SUPP-005","Pre-Workout Energy","Performance pre-workout",24,13,34.99,44.99,12.99,0.35,0),
  @(96,"TOY-001","Building Blocks Mega Set","1000-piece building set",25,12,49.99,64.99,19.99,1.5,1),
  @(97,"TOY-002","Remote Control Car Pro","High-speed RC car",25,12,79.99,99.99,34.99,0.8,0),
  @(98,"TOY-003","Board Game Strategy","Award-winning strategy game",25,12,39.99,49.99,14.99,1.2,0),
  @(99,"TOY-004","Science Experiment Kit","50 science experiments",25,12,34.99,44.99,12.99,1.0,0),
  @(100,"TOY-005","Plush Animal Collection","Set of 6 plush animals",25,12,29.99,39.99,9.99,0.6,0),
  @(101,"COMP-006","Wireless Keyboard Mouse","Ergonomic wireless combo",2,1,79.99,99.99,34.99,0.7,0),
  @(102,"COMP-007","4K Monitor 27in","IPS 4K HDR display",2,2,449.99,549.99,299.99,6.5,1),
  @(103,"COMP-008","USB-C Docking Station","12-in-1 USB-C hub",2,1,129.99,159.99,59.99,0.35,0),
  @(104,"PHONE-006","Phone Case Rugged","Military-grade protection",3,1,29.99,39.99,9.99,0.08,0),
  @(105,"PHONE-007","Wireless Charger Pad","15W fast wireless charger",3,1,34.99,44.99,14.99,0.15,0),
  @(106,"AUDIO-006","DJ Turntable Controller","Professional DJ controller",4,10,299.99,379.99,169.99,3.5,0),
  @(107,"AUDIO-007","Vinyl Record Player","Retro Bluetooth turntable",4,10,179.99,219.99,89.99,4.2,0),
  @(108,"FURN-007","Recliner Leather Chair","Power reclining leather chair",11,4,799.99,999.99,449.99,35.0,0),
  @(109,"FURN-008","Coffee Table Modern","Tempered glass coffee table",11,4,249.99,319.99,129.99,18.0,0),
  @(110,"FURN-009","Wardrobe Closet System","Modular closet organizer",11,4,599.99,749.99,329.99,42.0,0),
  @(111,"KITCH-007","Toaster Oven Smart","WiFi-connected toaster oven",12,14,199.99,249.99,99.99,5.5,0),
  @(112,"KITCH-008","Food Processor Deluxe","14-cup food processor",12,14,149.99,189.99,74.99,4.8,0),
  @(113,"DECOR-006","String Light LED Set","Warm white 100ft LED",13,4,24.99,34.99,9.99,0.4,0),
  @(114,"DECOR-007","Macrame Wall Hanging","Handmade boho wall hanging",13,13,44.99,59.99,17.99,0.5,0),
  @(115,"FIT-007","Pull-Up Bar Doorway","No-screw doorway pull-up bar",15,5,34.99,44.99,14.99,2.5,0),
  @(116,"FIT-008","Exercise Ball 65cm","Anti-burst stability ball",15,5,24.99,29.99,9.99,1.2,0),
  @(117,"CYCLE-006","Bike Lock Heavy Duty","U-lock with cable",16,8,49.99,64.99,19.99,1.4,0),
  @(118,"CAMP-006","Water Filter Portable","Backpacking water purifier",17,11,39.99,49.99,17.99,0.2,0),
  @(119,"CAMP-007","Hammock Double","Parachute nylon hammock",17,11,29.99,39.99,11.99,0.5,0),
  @(120,"SKIN-006","Eye Cream Anti-Aging","Peptide eye cream 15ml",23,7,27.99,34.99,9.99,0.06,0),
  @(121,"SKIN-007","Face Mask Sheet Pack","10-pack hydrating masks",23,7,16.99,22.99,5.99,0.2,0),
  @(122,"TOY-006","Puzzle 1000 Pieces","World landmark jigsaw",25,12,19.99,24.99,6.99,0.6,0),
  @(123,"TOY-007","Drone Mini Kids","Easy-fly mini drone",25,12,49.99,64.99,22.99,0.15,0),
  @(124,"MCLOTH-009","Running Sneakers Aero","Lightweight running shoes",7,8,119.99,149.99,54.99,0.3,1),
  @(125,"MCLOTH-010","Swim Trunks Board","Quick-dry board shorts",7,8,34.99,44.99,14.99,0.2,0),
  @(126,"WCLOTH-008","Running Shoes Women","Women cushioned runners",8,8,109.99,139.99,49.99,0.28,0),
  @(127,"WCLOTH-009","Puffer Jacket Hooded","Packable puffer jacket",8,3,129.99,169.99,59.99,0.5,0),
  @(128,"WCLOTH-010","Sports Bra High Impact","High support sports bra",8,5,44.99,54.99,18.99,0.12,0),
  @(129,"BOOK-T06","DevOps Handbook 2nd Ed","Modern DevOps practices",21,15,46.99,56.99,15.99,0.82,0),
  @(130,"BOOK-T07","System Design Interview","System design interviews",21,15,37.99,47.99,11.99,0.7,1),
  @(131,"BOOK-F06","Silver Linings","Heartwarming family saga",19,6,14.99,18.99,4.99,0.38,0),
  @(132,"BOOK-F07","The Phoenix Protocol","Cyber thriller novel",19,6,16.99,20.99,5.99,0.4,0),
  @(133,"SUPP-006","Vitamin D3 5000IU","High-potency vitamin D",24,13,14.99,19.99,4.99,0.15,0),
  @(134,"SUPP-007","Probiotics 50 Billion","Multi-strain probiotic",24,13,29.99,37.99,10.99,0.2,0),
  @(135,"SUPP-008","Creatine Monohydrate","Pure creatine powder 500g",24,13,19.99,24.99,7.99,0.55,0),
  @(136,"CAM-006","Tripod Professional","Carbon fiber travel tripod",5,9,199.99,249.99,99.99,1.5,0),
  @(137,"CAM-007","Camera Bag Backpack","Weather-resistant camera bag",5,9,89.99,109.99,39.99,1.2,0),
  @(138,"KCLOTH-004","Kids Snow Boots","Insulated waterproof boots",9,12,44.99,59.99,19.99,0.5,0),
  @(139,"KCLOTH-005","Girls Summer Dress","Floral cotton sundress",9,12,24.99,34.99,9.99,0.18,0),
  @(140,"KCLOTH-006","Boys Athletic Shorts","Moisture-wicking shorts 3pk",9,12,29.99,39.99,11.99,0.25,0),
  @(141,"DECOR-008","Succulent Planter Set","Ceramic planters set of 4",13,13,34.99,44.99,14.99,1.8,0),
  @(142,"DECOR-009","Smart LED Bulbs 4-Pack","WiFi color-changing bulbs",13,1,39.99,49.99,17.99,0.4,0),
  @(143,"FIT-009","Foam Roller Recovery","High-density muscle roller",15,5,19.99,24.99,7.99,0.4,0),
  @(144,"FIT-010","Jump Rope Speed","Adjustable speed jump rope",15,5,14.99,19.99,4.99,0.2,0),
  @(145,"CAMP-008","Headlamp 1000 Lumens","Rechargeable LED headlamp",17,11,27.99,34.99,10.99,0.1,0),
  @(146,"CAMP-009","Insulated Water Bottle 32oz","Vacuum insulated bottle",17,11,29.99,39.99,12.99,0.45,0),
  @(147,"TOY-008","Wooden Train Set","100-piece wooden railway",25,12,44.99,59.99,18.99,2.0,0),
  @(148,"TOY-009","Art Supply Kit Kids","150-piece deluxe art set",25,12,34.99,44.99,13.99,1.5,0),
  @(149,"AUDIO-008","Microphone USB Studio","Professional USB condenser",4,10,119.99,149.99,54.99,0.65,0),
  @(150,"AUDIO-009","DAC Headphone Amp","Hi-res USB DAC amp",4,10,199.99,249.99,99.99,0.35,0)
)

$rng = [System.Random]::new(42)
$bulkBody = ""
foreach ($p in $products) {
  $id = $p[0]; $sku = $p[1]; $name = $p[2]; $desc = $p[3]; $catId = $p[4]; $brandId = $p[5]
  $price = $p[6]; $comparePrice = $p[7]; $costPrice = $p[8]; $weight = $p[9]; $featured = $p[10]
  $margin = [math]::Round((($price - $costPrice) / $price) * 100, 1)
  $stock = $rng.Next(5, 500)
  $reserved = $rng.Next(0, 15)
  $warehouses = @("A-01","A-02","A-03","B-01","B-02","B-03","C-01","C-02","D-01","D-02")
  $wh = $warehouses[$rng.Next(0, $warehouses.Length)]
  $avgRating = [math]::Round(3.0 + $rng.NextDouble() * 2.0, 1)
  $reviewCount = $rng.Next(2, 60)
  $totalSold = $rng.Next(10, 500)
  $revenue = [math]::Round($totalSold * $price, 2)
  $daysAgo = $rng.Next(60, 730)
  $createdAt = (Get-Date).AddDays(-$daysAgo).ToString("yyyy-MM-ddTHH:mm:ss")

  $cat = $categories[$catId]
  $parentCat = $parentCategories[$catId]
  $brand = $brands[$brandId]

  $doc = @{
    product_id = $id; sku = $sku; name = $name; description = $desc
    category = $cat; parent_category = $parentCat; brand = $brand
    price = $price; compare_at_price = $comparePrice; cost_price = $costPrice
    margin_percent = $margin; weight_kg = $weight
    is_active = $true; is_featured = ($featured -eq 1)
    stock_quantity = $stock; reserved = $reserved; warehouse_location = $wh
    avg_rating = $avgRating; review_count = $reviewCount
    total_sold = $totalSold; revenue = $revenue; created_at = $createdAt
  } | ConvertTo-Json -Compress
  $bulkBody += "{`"index`":{`"_index`":`"product_catalog`",`"_id`":`"$id`"}}`n$doc`n"
}
Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $bulkBody | Out-Null
Write-Host "  -> 150 products indexed" -ForegroundColor Gray

# ══════════════════════════════════════════════════
# 2. ORDER_ANALYTICS INDEX
# ══════════════════════════════════════════════════
Write-Host "`n[2/4] Creating order_analytics index..." -ForegroundColor Green

$orderMapping = @"
{
  "mappings": {
    "properties": {
      "order_id": { "type": "integer" },
      "order_number": { "type": "keyword" },
      "customer_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "customer_email": { "type": "keyword" },
      "customer_gender": { "type": "keyword" },
      "customer_city": { "type": "keyword" },
      "customer_state": { "type": "keyword" },
      "status": { "type": "keyword" },
      "items": {
        "type": "nested",
        "properties": {
          "product_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
          "category": { "type": "keyword" },
          "brand": { "type": "keyword" },
          "quantity": { "type": "integer" },
          "unit_price": { "type": "float" },
          "total_price": { "type": "float" }
        }
      },
      "item_count": { "type": "integer" },
      "subtotal": { "type": "float" },
      "discount_amount": { "type": "float" },
      "shipping_cost": { "type": "float" },
      "tax_amount": { "type": "float" },
      "total": { "type": "float" },
      "payment_method": { "type": "keyword" },
      "payment_status": { "type": "keyword" },
      "carrier": { "type": "keyword" },
      "coupon_code": { "type": "keyword" },
      "ordered_at": { "type": "date" },
      "shipped_at": { "type": "date" },
      "delivered_at": { "type": "date" }
    }
  }
}
"@
Invoke-RestMethod -Method PUT "$ES/order_analytics" -ContentType "application/json" -Body $orderMapping | Out-Null

# Customer names for order generation
$firstNames = @("James","Maria","Robert","Jennifer","Michael","Linda","David","Elizabeth","William","Susan","Richard","Jessica","Joseph","Sarah","Thomas","Karen","Christopher","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley","Steven","Dorothy","Paul","Kimberly","Andrew","Emily","Joshua","Donna","Kenneth","Michelle","Kevin","Carol")
$lastNames = @("Smith","Garcia","Johnson","Williams","Brown","Jones","Miller","Davis","Martinez","Anderson","Taylor","Thomas","Hernandez","Moore","Martin","Jackson","Thompson","White","Lopez","Lee","Gonzalez","Harris","Clark","Lewis","Robinson","Walker","Perez","Hall","Young","Allen")
$cities = @("New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","San Jose","Austin","Jacksonville","San Francisco","Columbus","Indianapolis","Fort Worth","Charlotte","Seattle","Denver","Nashville")
$states = @("NY","CA","IL","TX","AZ","PA","TX","CA","TX","CA","TX","FL","CA","OH","IN","TX","NC","WA","CO","TN")
$statuses = @("pending","processing","shipped","delivered","delivered","delivered","delivered","delivered","shipped","shipped","cancelled","refunded")
$paymentMethods = @("credit_card","credit_card","credit_card","debit_card","paypal")
$carriers = @("FedEx","UPS","USPS","DHL")
$couponCodes = @($null,$null,$null,$null,"WELCOME10","SAVE20","SUMMER25","TECH15","FREESHIP","HOLIDAY20")

# Generate 500 orders (realistic sample of the 2000 in SQL)
$orderBulk = ""
for ($i = 1; $i -le 500; $i++) {
  $custIdx = $rng.Next(0, $firstNames.Length)
  $cityIdx = $rng.Next(0, $cities.Length)
  $custName = "$($firstNames[$custIdx]) $($lastNames[$custIdx % $lastNames.Length])"
  $custEmail = "$($firstNames[$custIdx].ToLower()).$($lastNames[$custIdx % $lastNames.Length].ToLower())@email.com"
  $gender = if ($custIdx % 2 -eq 0) { "male" } else { "female" }
  $status = $statuses[$rng.Next(0, $statuses.Length)]
  $daysAgo = $rng.Next(1, 730)
  $orderedAt = (Get-Date).AddDays(-$daysAgo).AddHours($rng.Next(0,24)).AddMinutes($rng.Next(0,60))

  # Generate 1-5 items per order
  $numItems = $rng.Next(1, 6)
  $items = @()
  $subtotal = 0.0
  for ($j = 0; $j -lt $numItems; $j++) {
    $prodIdx = $rng.Next(0, $products.Length)
    $prod = $products[$prodIdx]
    $qty = $rng.Next(1, 4)
    $unitPrice = $prod[6]
    $totalPrice = [math]::Round($unitPrice * $qty, 2)
    $subtotal += $totalPrice
    $items += @{
      product_name = $prod[2]
      category = $categories[$prod[4]]
      brand = $brands[$prod[5]]
      quantity = $qty
      unit_price = $unitPrice
      total_price = $totalPrice
    }
  }

  $discount = if ($rng.NextDouble() -lt 0.25) { [math]::Round($rng.NextDouble() * 30 + 5, 2) } else { 0 }
  $shipping = if ($rng.NextDouble() -lt 0.3) { 0 } else { [math]::Round(5.99 + $rng.NextDouble() * 9, 2) }
  $tax = [math]::Round($subtotal * 0.08, 2)
  $total = [math]::Round($subtotal - $discount + $shipping + $tax, 2)
  if ($total -lt 0) { $total = [math]::Round($subtotal + $shipping + $tax, 2); $discount = 0 }

  $payMethod = $paymentMethods[$rng.Next(0, $paymentMethods.Length)]
  $payStatus = switch ($status) {
    "cancelled" { "failed" }
    "refunded"  { "refunded" }
    "pending"   { "pending" }
    default     { "completed" }
  }
  $carrier = if ($status -in @("shipped","delivered")) { $carriers[$rng.Next(0, $carriers.Length)] } else { $null }
  $coupon = $couponCodes[$rng.Next(0, $couponCodes.Length)]

  $shippedAt = if ($status -in @("shipped","delivered")) { $orderedAt.AddDays($rng.Next(1,4)).ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }
  $deliveredAt = if ($status -eq "delivered") { $orderedAt.AddDays($rng.Next(3,10)).ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }

  $orderDoc = [ordered]@{
    order_id = $i
    order_number = "ORD-$($i.ToString('D6'))"
    customer_name = $custName
    customer_email = $custEmail
    customer_gender = $gender
    customer_city = $cities[$cityIdx]
    customer_state = $states[$cityIdx]
    status = $status
    items = $items
    item_count = $numItems
    subtotal = [math]::Round($subtotal, 2)
    discount_amount = $discount
    shipping_cost = $shipping
    tax_amount = $tax
    total = $total
    payment_method = $payMethod
    payment_status = $payStatus
    carrier = $carrier
    coupon_code = $coupon
    ordered_at = $orderedAt.ToString("yyyy-MM-ddTHH:mm:ss")
    shipped_at = $shippedAt
    delivered_at = $deliveredAt
  }
  $doc = $orderDoc | ConvertTo-Json -Compress -Depth 5
  $orderBulk += "{`"index`":{`"_index`":`"order_analytics`",`"_id`":`"$i`"}}`n$doc`n"

  # Flush every 100 orders
  if ($i % 100 -eq 0) {
    Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $orderBulk | Out-Null
    $orderBulk = ""
    Write-Host "  -> $i orders indexed..." -ForegroundColor Gray
  }
}
if ($orderBulk.Length -gt 0) {
  Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $orderBulk | Out-Null
}
Write-Host "  -> 500 orders indexed" -ForegroundColor Gray

# ══════════════════════════════════════════════════
# 3. CUSTOMER_INSIGHTS INDEX
# ══════════════════════════════════════════════════
Write-Host "`n[3/4] Creating customer_insights index..." -ForegroundColor Green

$customerMapping = @"
{
  "mappings": {
    "properties": {
      "customer_id": { "type": "integer" },
      "full_name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "email": { "type": "keyword" },
      "phone": { "type": "keyword" },
      "gender": { "type": "keyword" },
      "age": { "type": "integer" },
      "age_group": { "type": "keyword" },
      "city": { "type": "keyword" },
      "state": { "type": "keyword" },
      "country": { "type": "keyword" },
      "total_orders": { "type": "integer" },
      "total_spent": { "type": "float" },
      "avg_order_value": { "type": "float" },
      "first_order_date": { "type": "date" },
      "last_order_date": { "type": "date" },
      "days_since_last_order": { "type": "integer" },
      "favorite_category": { "type": "keyword" },
      "favorite_brand": { "type": "keyword" },
      "review_count": { "type": "integer" },
      "avg_rating_given": { "type": "float" },
      "wishlist_count": { "type": "integer" },
      "cart_items_count": { "type": "integer" },
      "is_active": { "type": "boolean" },
      "loyalty_tier": { "type": "keyword" },
      "created_at": { "type": "date" }
    }
  }
}
"@
Invoke-RestMethod -Method PUT "$ES/customer_insights" -ContentType "application/json" -Body $customerMapping | Out-Null

$allFirstNames = @("James","Maria","Robert","Jennifer","Michael","Linda","David","Elizabeth","William","Susan","Richard","Jessica","Joseph","Sarah","Thomas","Karen","Christopher","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley","Steven","Dorothy","Paul","Kimberly","Andrew","Emily","Joshua","Donna","Kenneth","Michelle","Kevin","Carol","Brian","Amanda","George","Stephanie","Edward","Rebecca","Ronald","Sharon","Timothy","Laura","Jason","Deborah","Ryan","Carolyn","Jacob","Janet","Gary","Catherine","Nicholas","Heather","Eric","Helen","Jonathan","Samantha","Stephen","Christine","Larry","Katherine","Frank","Virginia","Scott","Debra","Brandon","Rachel","Benjamin","Brenda","Samuel","Diane","Gregory","Cynthia","Alexander","Amy","Patrick","Angela","Raymond","Melissa","Jack","Julie","Dennis","Emma","Jerry","Megan","Tyler","Diana","Aaron","Natalie","Henry","Gloria","Jose","Teresa")
$allLastNames = @("Smith","Garcia","Johnson","Williams","Brown","Jones","Miller","Davis","Martinez","Anderson","Taylor","Thomas","Hernandez","Moore","Martin","Jackson","Thompson","White","Lopez","Lee","Gonzalez","Harris","Clark","Lewis","Robinson","Walker","Perez","Hall","Young","Allen","Sanchez","Wright","King","Scott","Green","Baker","Adams","Nelson","Hill","Ramirez","Campbell","Mitchell","Roberts","Carter","Phillips","Evans","Turner","Torres","Parker","Collins","Edwards","Stewart","Flores","Morris","Nguyen","Murphy","Rivera","Cook","Rogers","Morgan","Peterson","Cooper","Reed","Bailey","Bell","Gomez","Kelly","Howard","Ward","Cox","Diaz","Richardson","Wood","Watson","Brooks","Bennett","Gray","James","Reyes","Cruz")

$favCategories = @("Electronics","Clothing","Home & Garden","Sports & Outdoors","Books","Health & Beauty","Toys & Games")
$favBrands = @("TechPro","Zenith Electronics","UrbanStyle","HomeNest","FitLife","PageTurn","NaturGlow","SwiftGear","PixelCraft","SoundWave")
$loyaltyTiers = @("Bronze","Silver","Gold","Platinum")

$custBulk = ""
for ($i = 1; $i -le 200; $i++) {
  $fn = $allFirstNames[($i - 1) % $allFirstNames.Length]
  $ln = $allLastNames[($i - 1) % $allLastNames.Length]
  $email = "$($fn.ToLower()).$($ln.ToLower())@email.com"
  $phone = "555-$($i.ToString('D4'))"
  $gender = if ($i % 2 -eq 1) { "male" } else { "female" }
  $age = $rng.Next(22, 65)
  $ageGroup = if ($age -lt 25) { "18-24" } elseif ($age -lt 35) { "25-34" } elseif ($age -lt 45) { "35-44" } elseif ($age -lt 55) { "45-54" } else { "55+" }
  $cityIdx = $rng.Next(0, $cities.Length)

  $totalOrders = $rng.Next(1, 25)
  $totalSpent = [math]::Round($totalOrders * ($rng.NextDouble() * 200 + 50), 2)
  $avgOV = [math]::Round($totalSpent / $totalOrders, 2)
  $firstDaysAgo = $rng.Next(300, 730)
  $lastDaysAgo = $rng.Next(1, 300)
  $firstOrder = (Get-Date).AddDays(-$firstDaysAgo).ToString("yyyy-MM-ddTHH:mm:ss")
  $lastOrder = (Get-Date).AddDays(-$lastDaysAgo).ToString("yyyy-MM-ddTHH:mm:ss")
  $favCat = $favCategories[$rng.Next(0, $favCategories.Length)]
  $favBrand = $favBrands[$rng.Next(0, $favBrands.Length)]
  $reviewCnt = $rng.Next(0, 20)
  $avgRatingGiven = [math]::Round(2.5 + $rng.NextDouble() * 2.5, 1)
  $wishCnt = $rng.Next(0, 10)
  $cartCnt = $rng.Next(0, 5)
  $tier = if ($totalSpent -gt 3000) { "Platinum" } elseif ($totalSpent -gt 1500) { "Gold" } elseif ($totalSpent -gt 500) { "Silver" } else { "Bronze" }
  $createdDaysAgo = $rng.Next($firstDaysAgo, 730 + 1)
  $createdAt = (Get-Date).AddDays(-$createdDaysAgo).ToString("yyyy-MM-ddTHH:mm:ss")

  $custDoc = [ordered]@{
    customer_id = $i; full_name = "$fn $ln"; email = $email; phone = $phone
    gender = $gender; age = $age; age_group = $ageGroup
    city = $cities[$cityIdx]; state = $states[$cityIdx]; country = "United States"
    total_orders = $totalOrders; total_spent = $totalSpent; avg_order_value = $avgOV
    first_order_date = $firstOrder; last_order_date = $lastOrder
    days_since_last_order = $lastDaysAgo
    favorite_category = $favCat; favorite_brand = $favBrand
    review_count = $reviewCnt; avg_rating_given = $avgRatingGiven
    wishlist_count = $wishCnt; cart_items_count = $cartCnt
    is_active = $true; loyalty_tier = $tier; created_at = $createdAt
  } | ConvertTo-Json -Compress
  $custBulk += "{`"index`":{`"_index`":`"customer_insights`",`"_id`":`"$i`"}}`n$custDoc`n"

  if ($i % 100 -eq 0) {
    Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $custBulk | Out-Null
    $custBulk = ""
    Write-Host "  -> $i customers indexed..." -ForegroundColor Gray
  }
}
if ($custBulk.Length -gt 0) {
  Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $custBulk | Out-Null
}
Write-Host "  -> 200 customers indexed" -ForegroundColor Gray

# ══════════════════════════════════════════════════
# 4. DAILY_SALES INDEX (Time-series)
# ══════════════════════════════════════════════════
Write-Host "`n[4/4] Creating daily_sales index..." -ForegroundColor Green

$dailyMapping = @"
{
  "mappings": {
    "properties": {
      "date": { "type": "date", "format": "yyyy-MM-dd" },
      "total_orders": { "type": "integer" },
      "total_revenue": { "type": "float" },
      "avg_order_value": { "type": "float" },
      "total_items_sold": { "type": "integer" },
      "unique_customers": { "type": "integer" },
      "discount_given": { "type": "float" },
      "shipping_revenue": { "type": "float" },
      "tax_collected": { "type": "float" },
      "refund_count": { "type": "integer" },
      "cancelled_count": { "type": "integer" },
      "top_category": { "type": "keyword" },
      "credit_card_orders": { "type": "integer" },
      "paypal_orders": { "type": "integer" },
      "debit_card_orders": { "type": "integer" }
    }
  }
}
"@
Invoke-RestMethod -Method PUT "$ES/daily_sales" -ContentType "application/json" -Body $dailyMapping | Out-Null

$salesBulk = ""
$topCats = @("Electronics","Clothing","Home & Garden","Sports & Outdoors","Books","Health & Beauty","Toys & Games")
$today = Get-Date
for ($d = 0; $d -lt 365; $d++) {
  $date = $today.AddDays(-$d).ToString("yyyy-MM-dd")
  $dayOfWeek = $today.AddDays(-$d).DayOfWeek
  $baseOrders = if ($dayOfWeek -in @("Saturday","Sunday")) { $rng.Next(8, 18) } else { $rng.Next(3, 12) }
  # Add seasonal boost for holiday months
  $month = $today.AddDays(-$d).Month
  if ($month -in @(11, 12)) { $baseOrders = [int]($baseOrders * 1.5) }
  
  $totalRevenue = [math]::Round($baseOrders * ($rng.NextDouble() * 150 + 80), 2)
  $avgOV = [math]::Round($totalRevenue / [math]::Max($baseOrders, 1), 2)
  $itemsSold = $rng.Next($baseOrders, $baseOrders * 4)
  $uniqueCustomers = [math]::Min($baseOrders, $rng.Next([int]($baseOrders * 0.6), $baseOrders + 1))
  $discounts = [math]::Round($rng.NextDouble() * 50, 2)
  $shippingRev = [math]::Round($baseOrders * ($rng.NextDouble() * 5 + 3), 2)
  $taxCollected = [math]::Round($totalRevenue * 0.08, 2)
  $refunds = if ($rng.NextDouble() -lt 0.15) { $rng.Next(1, 3) } else { 0 }
  $cancels = if ($rng.NextDouble() -lt 0.1) { 1 } else { 0 }
  $topCat = $topCats[$rng.Next(0, $topCats.Length)]
  $ccOrders = [int]($baseOrders * 0.6)
  $ppOrders = [int]($baseOrders * 0.2)
  $dcOrders = $baseOrders - $ccOrders - $ppOrders

  $salesDoc = [ordered]@{
    date = $date
    total_orders = $baseOrders
    total_revenue = $totalRevenue
    avg_order_value = $avgOV
    total_items_sold = $itemsSold
    unique_customers = $uniqueCustomers
    discount_given = $discounts
    shipping_revenue = $shippingRev
    tax_collected = $taxCollected
    refund_count = $refunds
    cancelled_count = $cancels
    top_category = $topCat
    credit_card_orders = $ccOrders
    paypal_orders = $ppOrders
    debit_card_orders = $dcOrders
  } | ConvertTo-Json -Compress
  $salesBulk += "{`"index`":{`"_index`":`"daily_sales`",`"_id`":`"$date`"}}`n$salesDoc`n"

  if ($d % 100 -eq 0 -and $d -gt 0) {
    Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $salesBulk | Out-Null
    $salesBulk = ""
    Write-Host "  -> $d days indexed..." -ForegroundColor Gray
  }
}
if ($salesBulk.Length -gt 0) {
  Invoke-RestMethod -Method POST "$ES/_bulk" -ContentType "application/x-ndjson" -Body $salesBulk | Out-Null
}
Write-Host "  -> 365 daily_sales records indexed" -ForegroundColor Gray

# ── Verify ──────────────────────────────────────
Write-Host "`n=== Verification ===" -ForegroundColor Cyan
$indices = Invoke-RestMethod "$ES/_cat/indices?v&h=index,docs.count,store.size" -Method GET
Write-Host $indices
Write-Host "`n=== Seed Complete! ===" -ForegroundColor Green
