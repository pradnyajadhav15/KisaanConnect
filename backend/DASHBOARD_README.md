# KisaanConnect Dashboards

This document explains how to use the farmer and consumer dashboards in the KisaanConnect platform.

## Overview

The KisaanConnect platform now includes:

1. **Farmer Dashboard** - Manage crop listings, view sales statistics
2. **Consumer Dashboard** - Browse products, manage shopping cart, place orders

Both dashboards are available without any login/authentication requirements.

## Farmer Dashboard

### API Endpoints

- `GET /farmer` - List all crops
- `GET /farmer/{crop_id}` - Get details of a specific crop
- `POST /farmer` - Add a new crop listing
- `PUT /farmer/{crop_id}` - Update a crop listing
- `DELETE /farmer/{crop_id}` - Delete a crop listing
- `GET /farmer/dashboard/stats` - Get dashboard statistics

### Example: Adding a new crop

```json
POST /farmer
{
  "name": "Rice",
  "quantity": 100,
  "unit": "kg",
  "price_per_unit": 45.0,
  "description": "High quality Basmati rice",
  "location": "Punjab",
  "available": true
}
```

## Consumer Dashboard

### API Endpoints

- `GET /consumer/marketplace` - Browse all available products
- `GET /consumer/cart/{cart_id}` - View items in cart
- `POST /consumer/cart` - Add item to cart
- `DELETE /consumer/cart/{cart_id}/item/{item_id}` - Remove item from cart
- `POST /consumer/orders` - Create a new order
- `GET /consumer/orders/{order_id}` - View order details
- `GET /consumer/dashboard/stats` - Get dashboard statistics

### Example: Adding an item to cart

```json
POST /consumer/cart
{
  "crop_id": 1,
  "quantity": 5,
  "cart_id": "550e8400-e29b-41d4-a716-446655440000",
  "unit_price": 45.0
}
```

### Example: Creating an order

```json
POST /consumer/orders
{
  "total_amount": 225.0,
  "status": "pending",
  "shipping_address": "123 Main St, Mumbai, India",
  "items": [
    {
      "id": 1,
      "crop_id": 1,
      "quantity": 5,
      "cart_id": "550e8400-e29b-41d4-a716-446655440000",
      "unit_price": 45.0,
      "crop_name": "Rice"
    }
  ]
}
```

## Testing the Dashboards

You can test all the dashboard endpoints using the included `test_api.py` script:

```bash
# First start the server
./run_app.bat

# Then in another terminal, run the test script
python test_api.py
```

## Integration with Frontend

These dashboards can be easily integrated with the React frontend by making API calls to the endpoints. Check the API documentation at http://localhost:8000/docs for more details. 