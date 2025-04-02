const express = require("express");
const router = express.Router();
const session = require('express-session');
const { executeQuery } = require("../dbUtils/db");
const fs = require('fs');
const moment = require("moment-timezone"); 
const path = require('path');

// API to update order approved_status
router.post("/update-order-status", async (req, res) => {
    try {
        const { id, approve_status } = req.body;

        // Validate input
        if (!id || !approve_status) {
            return res.status(400).json({ message: "id and approved_status are required" });
        }

        // Update query with conditional altered status
        const query = "UPDATE orders SET approve_status = ?, altered = CASE WHEN ? = 'Accepted' THEN 'No' ELSE altered END WHERE id = ?";
        const values = [approve_status, approve_status, id];




        // Execute the query
        const result = await executeQuery(query, values);

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: "Order status updated successfully" });
        } else {
            return res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

router.get('/images/products/:filename', (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, '..', 'uploads', 'products', filename);
  
    res.sendFile(imagePath, (err) => {
      if (err) {
        console.error('Error sending image:', err);
        res.status(404).send('Image not found');
      }
    });
  });



router.post("/update-delivery-status", async (req, res) => {
    try {
        // **Correctly extract order_id from req.body**
        const { customer_id, delivery_status, order_id } = req.body;

        if (!customer_id || !delivery_status || !order_id) { // **Added check for order_id**
            return res.status(400).json({ status: false, message: "Customer ID, order ID, and delivery status are required" }); // **Updated message**
        }

        if (!["pending", "delivered"].includes(delivery_status.toLowerCase())) {
            return res.status(400).json({ status: false, message: "Invalid delivery status" });
        }

        // **Update the delivery status for the SPECIFIC order ID from the request**
        const updateQuery = "UPDATE orders SET delivery_status = ? WHERE id = ?"; // **WHERE id = ? is now correct for order_id**
        const updateValues = [delivery_status.toLowerCase(), order_id]; // **Using order_id from request!**
        const updateResult = await executeQuery(updateQuery, updateValues);

        if (updateResult.affectedRows > 0) {
            return res.json({
                status: true,
                message: "Delivery status updated successfully",
                order_id: order_id // **Returning the CORRECT order_id that was updated**
            });
        } else {
            return res.status(404).json({ status: false, message: "Order not found or failed to update", order_id: order_id }); // **Return order_id in error response too**
        }
    } catch (error) {
        console.error("Error updating delivery status:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
});


router.get("/get-orders/:customer_id", async (req, res) => {
    try {
        const { customer_id } = req.params;

        if (!customer_id) {
            return res.status(400).json({ status: false, message: "Customer ID is required" });
        }

        const fetchQuery = "SELECT id,total_amount,customer_id,delivery_status,approve_status,cancelled,placed_on,loading_slip FROM orders WHERE customer_id = ? ORDER BY id DESC";
        const fetchResult = await executeQuery(fetchQuery, [customer_id]);

        if (fetchResult.length > 0) {
            return res.json({ status: true, orders: fetchResult });
        } else {
            return res.json({ status: true, orders: [] });
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
});




// API to fetch orders for a specific admin with total indent amount
router.get("/get-admin-orders/:admin_id", async (req, res) => {
    try {
        const { admin_id } = req.params;

        if (!admin_id) {
            return res.status(400).json({ success: false, message: "Admin ID is required" });
        }

        // Updated SQL Query to fetch orders along with total indent amount
        const query = `
            SELECT o.*, 
                   SUM(op.price * op.quantity) AS amount 
            FROM orders o
            JOIN admin_assign a ON o.customer_id = a.cust_id
            LEFT JOIN order_products op ON o.id = op.order_id
            WHERE a.admin_id = ?
            GROUP BY o.id;
        `;

        const orders = await executeQuery(query, [admin_id]);

        res.json({ success: true, orders });

    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});




router.get("/order-by-date-shift", async (req, res) => {
    try {
        const { customerId, orderDate, orderType } = req.query;

        // Validate input
        if (!customerId || !orderDate || !orderType) {
            return res.status(400).json({ message: "customerId, orderDate, and orderType are required" });
        }

        // **Corrected SQL Query for INTEGER timestamp - Use FROM_UNIXTIME**
        // CONVERT_TZ is added to handle potential timezone differences, converting to 'UTC' for consistency.
        const query = `
            SELECT *
            FROM orders
            WHERE customer_id = ?
              AND DATE(CONVERT_TZ(FROM_UNIXTIME(placed_on), '+00:00', '+00:00')) = STR_TO_DATE(?, '%Y-%d-%m')
              AND order_type = ?
        `;
        const values = [customerId, orderDate, orderType];

        // Execute the query using await executeQuery
        const results = await executeQuery(query, values); // AWAIT the result

        if (results && results.length > 0) {
            // Order found - return the first result
            return res.status(200).json(results[0]);
        } else {
            // No order found
            return res.status(404).json({ message: "Order not found" });
        }

    } catch (error) { // Error handling using try...catch - simplified and cleaner
        console.error("Error fetching order by date and shift:", error);
        return res.status(500).json({ message: "Internal server error", error: error });
    }
});



router.get("/order-products", async (req, res) => { // <-- GET request, path: /order-products (now expects orderId as query parameter)
    try {
        const { orderId } = req.query; // Extract orderId from query parameters

        // Validate input - check if orderId is provided
        if (!orderId) {
            return res.status(400).json({ message: "orderId is required as a query parameter" });
        }

        // SQL query - fetch product details for a specific orderId
        const queryStatement = `
            SELECT
                order_id,
                product_id,
                quantity,
                price,
                name,
                category
            FROM
                order_products
            WHERE
                order_id = ?  -- Filter by orderId
        `;
        const params = [orderId]; // Parameter array with orderId

        // Execute the query using executeQuery
        const results = await executeQuery(queryStatement, params); // AWAIT the result

        if (results && results.length > 0) {
            // Products found for the given orderId - format and return
            const productList = results.map(row => ({
                order_id: row.order_id,
                product_id: row.product_id,
                quantity: row.quantity,
                price: row.price,
                name: row.name,
                category: row.category
            }));
            return res.status(200).json(productList);
        } else {
            // No products found for the given orderId
            return res.status(404).json({ message: "No products found for orderId: " + orderId });
        }

    } catch (error) { // Error handling
        console.error("Error fetching order products for orderId:", error);
        return res.status(500).json({ message: "Internal server error", error: error });
    }
});



// API to fetch the most recent order for a specific customer and order type
router.get("/most-recent-order", async (req, res) => {
    try {
        const { customerId, orderType } = req.query;

        if (!customerId || !orderType) {
            return res.status(400).json({ success: false, message: "Customer ID and Order Type are required" });
        }

        if (orderType !== 'AM' && orderType !== 'PM') {
            return res.status(400).json({ success: false, message: "Invalid Order Type. Must be 'AM' or 'PM'" });
        }

        // SQL Query to fetch the most recent order

        
        const query = `
            SELECT *  
            FROM orders  
            WHERE customer_id = ?  
            AND order_type = ?  
            ORDER BY FROM_UNIXTIME(placed_on) DESC  
            LIMIT 1;

        `;

        const recentOrder = await executeQuery(query, [customerId, orderType]);

        if (recentOrder && recentOrder.length > 0) {
            // Order found
            res.json({ success: true, order: recentOrder[0] }); // Return the first (most recent) order
        } else {
            // No order found
            res.json({ success: true, order: null, message: "No previous orders found for this customer and order type" });
        }

    } catch (error) {
        console.error("Error fetching most recent order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
});





// --- 1. DELETE Order Product (New Endpoint for immediate deletion) ---
router.delete("/delete_order_product/:orderProductId", async (req, res) => {
    try {
        const { orderProductId } = req.params; // Extract orderProductId from URL params

        if (!orderProductId) {
            return res.status(400).json({ success: false, message: "Order Product ID is required" });
        }

        const deleteOrderProductQuery = `DELETE FROM order_products WHERE product_id = ?`; // **Crucially: WHERE order_id = ?**
        const deleteResult = await executeQuery(deleteOrderProductQuery, [orderProductId]);

        if (deleteResult.affectedRows > 0) {
            console.log(`Deleted order_product with ID: ${orderProductId}`);
            res.json({ success: true, message: "Order product deleted successfully" });
        } else {
            res.status(404).json({ success: false, message: "Order product not found or already deleted" });
        }

    } catch (error) {
        console.error("Error deleting order product:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error });
    }
});


// --- 2. POST /order_update (Modified with cancellation and altered status logic) ---
router.post("/order_update", async (req, res) => {
    try {
        const { orderId, products, totalAmount } = req.body;

        // Input validation
        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }
        if (!products || !Array.isArray(products)) {
            return res.status(400).json({ success: false, message: "Products array is required" });
        }
        if (totalAmount === undefined || totalAmount === null) {
            return res.status(400).json({ success: false, message: "Total amount is required" });
        }

        // First check if any products exist for this order
        const checkProductsQuery = `
            SELECT COUNT(*) as count 
            FROM order_products 
            WHERE order_id = ?
        `;
        const [productCount] = await executeQuery(checkProductsQuery, [orderId]);
        
        // Set cancelled status based on products existence
        const cancelledStatus = (products.length === 0 || productCount.count === 0) ? 'Yes' : 'No';

        // Update order products if there are any
        if (products.length > 0) {
            for (const product of products) {
                const { order_id, quantity, price, is_new } = product;
                if (!order_id) {
                    return res.status(400).json({ success: false, message: "order_product_id is required for product updates" });
                }

                // Get current quantity for existing products
                let currentQuantity = 0;
                if (!is_new) {
                    const currentProductQuery = `SELECT quantity FROM order_products WHERE order_id = ? AND product_id = ?`;
                    const currentProduct = await executeQuery(currentProductQuery, [order_id, product.product_id]);
                    if (currentProduct.length > 0) {
                        currentQuantity = currentProduct[0].quantity;
                    }
                }

                if (is_new) {
                    const insertProductQuery = `
                        INSERT INTO order_products (order_id, product_id, quantity, price, name, category, altered)
                        VALUES (?, ?, ?, ?, ?, ?, 'No')
                    `;
                    await executeQuery(insertProductQuery, [orderId, product.product_id, quantity, price, product.name, product.category]);
                } else {
                    // Calculate the actual quantity difference
                    const quantityDifference = quantity - currentQuantity;
                    const quantityChange = quantityDifference !== 0 ? quantityDifference.toString() : null;
                    
                    const updateProductQuery = `
                        UPDATE order_products
                        SET quantity = ?, 
                            price = ?,
                            altered = ?,
                            quantity_change = ?
                        WHERE order_id = ? AND product_id = ?
                    `;
                    
                    let alteredStatus = currentQuantity !== quantity ? 'Yes' : 'No';
                    await executeQuery(updateProductQuery, [
                        quantity, 
                        price, 
                        alteredStatus,
                        quantityChange,
                        orderId, 
                        product.product_id
                    ]);
                }
            }
        }

        // Update total amount and cancelled status in orders table
        const updateOrderQuery = `
            UPDATE orders
            SET total_amount = ?,
                cancelled = ?,
                altered = 'Yes',
                approve_status = 'Altered'
            WHERE id = ?
        `;
        await executeQuery(updateOrderQuery, [totalAmount, cancelledStatus, orderId]);

        res.json({ 
            success: true, 
            message: `Order updated successfully. Status: ${cancelledStatus}`,
            cancelled: cancelledStatus
        });

    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error });
    }
});




// --- 3. CANCEL Order (Endpoint to cancel the order - Modified from DELETE) ---
router.post("/cancel_order/:orderId", async (req, res) => { // Changed to POST
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        // SQL query to DELETE from order_products table to remove product details
        const cancelOrderProductsQuery = `
            DELETE FROM order_products
            WHERE order_id = ?
        `;

        // Execute the query to cancel order products (DELETE instead of UPDATE)
        const cancelProductsResult = await executeQuery(cancelOrderProductsQuery, [orderId]);
        console.log("Order Products Cancel Result:", cancelProductsResult);

        // SQL query to update orders table to set total_amount to 0 and cancelled to 'Yes'
        const cancelOrdersTableQuery = `
            UPDATE orders
            SET total_amount = 0.0,
            cancelled = 'Yes'
            WHERE id = ?
        `;


        // Execute the query to cancel order in orders table
        const cancelOrdersResult = await executeQuery(cancelOrdersTableQuery, [orderId]);
        console.log("Order Table Cancel Result:", cancelOrdersResult);

        if (cancelOrdersResult.affectedRows > 0) { // Check if order in 'orders' table was updated
            console.log(`Cancelled order with ID: ${orderId}`);
            res.json({ success: true, message: "Order cancelled successfully for order ID: " + orderId });
        } else {
            res.status(404).json({ success: false, message: "Order not found or already cancelled" });
        }

    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error });
    }
});


// --- 2. ADD Product to Order (New Endpoint) ---
router.post("/add-product-to-order", async (req, res) => {
    try {
        const { orderId, productId, quantity, price, name, category } = req.body;

        // --- Input Validation ---
        if (!orderId || !productId || quantity === undefined || price === undefined) {
            return res.status(400).json({ success: false, message: "Missing required fields: orderId, productId, quantity, and price are required." });
        }
        if (isNaN(orderId) || isNaN(productId) || isNaN(quantity) || isNaN(price) || quantity <= 0 || price < 0) {
            return res.status(400).json({ success: false, message: "Invalid data types: orderId and productId must be numbers, quantity must be a positive number, and price must be a non-negative number." });
        }

        // --- Check if Order and Product Exist ---
        const orderExistsQuery = `SELECT id FROM orders WHERE id = ?`;
        const productExistsQuery = `SELECT id FROM products WHERE id = ?`;

        const orderExistsResult = await executeQuery(orderExistsQuery, [orderId]);
        if (orderExistsResult.length === 0) {
            return res.status(400).json({ success: false, message: `Order with ID ${orderId} not found.` });
        }

        const productExistsResult = await executeQuery(productExistsQuery, [productId]);
        if (productExistsResult.length === 0) {
            return res.status(400).json({ success: false, message: `Product with ID ${productId} not found.` });
        }

        // --- Check if the product is already in the order ---
        const productAlreadyInOrderQuery = `SELECT quantity FROM order_products WHERE order_id = ? AND product_id = ?`;
        const productInOrderResult = await executeQuery(productAlreadyInOrderQuery, [orderId, productId]);

        if (productInOrderResult.length > 0) {
            // Update quantity if different
            if (parseInt(productInOrderResult[0].quantity) !== parseInt(quantity)) {
                const updateQuery = `
                    UPDATE order_products 
                    SET quantity = ?, price = ?
                    WHERE order_id = ? AND product_id = ?
                `;
                await executeQuery(updateQuery, [quantity, price, orderId, productId]);

                return res.json({
                    success: true,
                    message: "Product quantity updated"
                });
            } else {
                return res.status(409).json({
                    success: false,
                    message: "Product already exists with same quantity"
                });
            }
        }

        // --- Insert new order_product record ---
        const insertQuery = `
            INSERT INTO order_products (order_id, product_id, quantity, price, name, category)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const insertResult = await executeQuery(insertQuery, [orderId, productId, quantity, price, name, category]);

        if (insertResult.affectedRows > 0) {
            console.log(`Product ID ${productId} added to order ID ${orderId}`);
            res.status(201).json({
                success: true,
                message: "Product added to order successfully",
                newOrderProductId: insertResult.insertId
            });
        } else {
            console.error("Failed to insert product into order");
            res.status(500).json({ success: false, message: "Failed to add product to order" });
        }

    } catch (error) {
        console.error("Error adding product to order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error });
    }
});

router.post("/on-behalf", async (req, res) => {
    try {
        const { customer_id, order_type, reference_order_id } = req.body;

        if (!customer_id || !order_type || !reference_order_id) {
            return res.status(400).json({
                message: "customer_id, order_type, and reference_order_id are required"
            });
        }

        // 1. Place Admin Order and get new_order_id
        const insertOrderQuery = `
            INSERT INTO orders (customer_id, total_amount, order_type, placed_on, created_at, updated_at)
            VALUES (?, 0.0, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
        `;
        const orderValues = [customer_id, order_type];
        const insertOrderResult = await executeQuery(insertOrderQuery, orderValues);
        const newOrderId = insertOrderResult.insertId;

        if (!newOrderId) {
            return res.status(500).json({ message: "Failed to create new order." });
        }

        // 2. Insert Order Products from reference order
        const insertOrderProductsQuery = `
        INSERT INTO order_products (order_id, product_id, quantity, price, name, category)
        SELECT ?, product_id, quantity, price, name, category
        FROM order_products
        WHERE order_id = ?
        AND LOWER(category) NOT LIKE '%Others%'
        AND LOWER(category) NOT LIKE '%paneer%'
        AND LOWER(category) NOT LIKE '%ghee%'
        AND LOWER(category) NOT LIKE '%butter%'
        AND LOWER(category) NOT LIKE '%butter milk%'
        `;
        const orderProductsValues = [newOrderId, reference_order_id];
        await executeQuery(insertOrderProductsQuery, orderProductsValues);

        // 3. Update total_amount in orders table
        const updateOrderTotalQuery = `
            UPDATE orders
            SET total_amount = (
                SELECT SUM(quantity * price)
                FROM order_products
                WHERE order_id = ?
            )
            WHERE id = ?
        `;
        const updateTotalValues = [newOrderId, newOrderId];
        await executeQuery(updateOrderTotalQuery, updateTotalValues);

        return res.status(201).json({
            message: "Admin order placed successfully with products copied.",
            new_order_id: newOrderId
        });

    } catch (error) {
        console.error("Error placing admin order with products:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
});

// Revised endpoint to update loading_slip status (following provided structure)
router.post('/update-loading-slip-status', async (req, res) => { // Changed to POST and removed :orderId from path
    try {
        const { orderId } = req.body; // Expecting orderId in request body

        // Validate input
        if (!orderId) {
            return res.status(400).json({ message: "Order ID is required in the request body" }); // More specific message
        }

        // Update query
        const query = 'UPDATE orders SET loading_slip = ? WHERE id = ?';
        const values = ['Yes', orderId];

        // Execute the query using executeQuery
        const result = await executeQuery(query, values);

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: "Loading slip status updated successfully." });
        } else {
            return res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        console.error("Error updating loading slip status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


router.get('/credit-limit', async (req, res) => {
    try {
        const { customerId } = req.query; // Expecting customerId as a query parameter, e.g., /credit-limit?customerId=123

        // Validate input
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required as a query parameter" });
        }

        const query = 'SELECT credit_limit FROM credit_limit WHERE customer_id = ?'; // Assuming table name is 'credit_limit' and columns are 'customer_id' and 'credit_limit'
        const values = [customerId];

        const result = await executeQuery(query, values);

        if (result.length > 0) {
            // Assuming credit_limit is the first column selected
            const creditLimit = result[0].credit_limit;
            return res.status(200).json({ creditLimit: creditLimit });
        } else {
            return res.status(404).json({ message: "Credit limit not found for this customer ID" });
        }

    } catch (error) {
        console.error("Error fetching credit limit:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});



router.post('/credit-limit/deduct', async (req, res) => {
    try {
        // 1. Get customerId and amountChange from request body
        const { customerId, amountChange } = req.body; // Renamed from orderAmount to amountChange

        // 2. Validate input
        if (!customerId || !amountChange || isNaN(parseFloat(amountChange))) {
            return res.status(400).json({ message: "Customer ID and amountChange are required and amountChange must be a number." });
        }
        const amountToChange = parseFloat(amountChange); // Renamed variable

        // 3. Fetch current credit limit for the customer
        const getCreditLimitQuery = 'SELECT credit_limit FROM credit_limit WHERE customer_id = ?';
        const creditLimitValues = [customerId];
        const creditLimitResult = await executeQuery(getCreditLimitQuery, creditLimitValues);

        if (creditLimitResult.length === 0) {
            return res.status(404).json({ message: "Credit limit not found for this customer." });
        }
        let currentCreditLimit = parseFloat(creditLimitResult[0].credit_limit);

        // 4. **Apply the amount change to the credit limit (can be deduction or addition)**
        const newCreditLimit = currentCreditLimit - amountToChange; // It's still subtraction, but amountChange can be negative for credit addition

        // **Optionally, add a check for negative credit limit if needed**
        // if (newCreditLimit < 0) {
        //     newCreditLimit = 0; // Or handle based on your business logic
        // }

        const updateCreditLimitQuery = 'UPDATE credit_limit SET credit_limit = ? WHERE customer_id = ?';
        const updateCreditLimitValues = [newCreditLimit, customerId];
        await executeQuery(updateCreditLimitQuery, updateCreditLimitValues);

        // 5. Return success response
        return res.status(200).json({ message: "Credit limit updated successfully", newCreditLimit: newCreditLimit }); // Message updated

    } catch (error) {
        console.error("Error updating credit limit:", error); // Message updated
        return res.status(500).json({ message: "Internal server error while updating credit limit." }); // Message updated
    }
});


// Modified API endpoint to correctly update credit_limit.amount_due for new orders AND order updates
router.post('/credit-limit/update-amount-due-on-order', async (req, res) => {
    try {
        const { customerId, totalOrderAmount, originalOrderAmount } = req.body; // Expect originalOrderAmount for updates

        if (!customerId || totalOrderAmount === undefined || totalOrderAmount === null) {
            return res.status(400).json({ message: "Missing customerId or totalOrderAmount in request." });
        }

        // 1. Get current amount_due from credit_limit
        const getCreditLimitQuery = 'SELECT amount_due FROM credit_limit WHERE customer_id = ?';
        const creditLimitValues = [customerId];
        const creditLimitResult = await executeQuery(getCreditLimitQuery, creditLimitValues);

        let currentAmountDue = 0;
        if (creditLimitResult.length > 0 && creditLimitResult[0].amount_due !== null) {
            currentAmountDue = parseFloat(creditLimitResult[0].amount_due);
        }

        let updatedAmountDue;

        if (originalOrderAmount !== undefined && originalOrderAmount !== null) {
            // It's an order UPDATE

            const orderAmountDifference = parseFloat(totalOrderAmount) - parseFloat(originalOrderAmount);

            updatedAmountDue = currentAmountDue + orderAmountDifference; // Add the DIFFERENCE (can be negative)

            if (updatedAmountDue < 0) { // Ensure amount_due doesn't go below zero (optional - depending on your business logic)
                updatedAmountDue = 0;
            }


        } else {
            // It's a NEW order
            updatedAmountDue = currentAmountDue + parseFloat(totalOrderAmount); // Original logic for new orders (ADD)
        }


        // 3. Update amount_due in credit_limit table
        const updateCreditLimitQuery = 'UPDATE credit_limit SET amount_due = ? WHERE customer_id = ?';
        const updateCreditLimitValues = [updatedAmountDue, customerId];
        await executeQuery(updateCreditLimitQuery, updateCreditLimitValues);

        console.log(`Credit_limit.amount_due updated for customer ${customerId}. New amount_due: ${updatedAmountDue}`);

        res.status(200).json({ success: true, message: "Credit limit amount_due updated successfully.", updatedAmountDue: updatedAmountDue }); // Send back updatedAmountDue
    } catch (error) {
        console.error("Error updating credit_limit.amount_due in /credit-limit/update-amount-due-on-order:", error);
        res.status(500).json({ success: false, message: "Failed to update credit limit amount_due." });
    }
});

router.post('/collect_cash', async (req, res) => {
    try {
        let customerId = req.query.customerId || req.body.customerId;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        const { cash } = req.body;

        // Fetch current customer data
        const fetchQuery = `
            SELECT amount_due, amount_paid_cash, credit_limit
            FROM credit_limit
            WHERE customer_id = ?`;
        const customerDataResult = await executeQuery(fetchQuery, [customerId]);

        if (customerDataResult.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        const { amount_due, amount_paid_cash = 0, credit_limit = 0 } = customerDataResult[0];
        let updatedAmountDue = amount_due;
        let newAmountPaidCash = amount_paid_cash; // Initialize here

        if (cash !== undefined && cash !== null) {
            const parsedCash = parseFloat(cash);
            if (isNaN(parsedCash) || parsedCash < 0) {
                return res.status(400).json({ message: "Invalid cash amount. Must be a non-negative number." });
            }

            newAmountPaidCash = amount_paid_cash + parsedCash;
            updatedAmountDue = Math.max(0, amount_due - parsedCash);
            const newCreditLimit = credit_limit + parsedCash;

            // **1. Insert into payment_transactions table**
            const insertTransactionQuery = `
                INSERT INTO payment_transactions (customer_id, payment_method, payment_amount, payment_date)
                VALUES (?, ?, ?, NOW())`; // NOW() gets current datetime in MySQL
            const transactionValues = [customerId, 'cash', parsedCash];
            await executeQuery(insertTransactionQuery, transactionValues);

            // **2. Update credit_limit table**
            const updateQuery = `
                UPDATE credit_limit
                SET amount_paid_cash = ?, amount_due = ?, credit_limit = ?, cash_paid_date = UNIX_TIMESTAMP()
                WHERE customer_id = ?`;
            const updateValues = [newAmountPaidCash, updatedAmountDue, newCreditLimit, customerId];
            await executeQuery(updateQuery, updateValues);

            return res.status(200).json({
                message: "Cash collected and transaction recorded successfully", // Updated message
                updatedAmountPaidCash: newAmountPaidCash,
                updatedAmountDue,
                updatedCreditLimit: newCreditLimit
            });
        }

        return res.status(200).json({ amountDue: updatedAmountDue });
    } catch (error) {
        console.error("Error processing cash collection:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


// New API endpoint to get total amount due across all customers
router.get('/admin/total-amount-due', async (req, res) => {
    try {
        // 1. SQL query to sum amount_due from credit_limit table
        const getTotalAmountDueQuery = 'SELECT SUM(amount_due) AS totalAmountDue FROM credit_limit';

        // 2. Execute the query
        const totalAmountDueResult = await executeQuery(getTotalAmountDueQuery);

        // 3. Extract totalAmountDue from the result
        let totalAmountDue = 0;
        if (totalAmountDueResult.length > 0 && totalAmountDueResult[0].totalAmountDue !== null) {
            totalAmountDue = parseFloat(totalAmountDueResult[0].totalAmountDue);
        }

        // 4. Respond with the total amount due
        res.status(200).json({ success: true, totalAmountDue: totalAmountDue });

    } catch (error) {
        console.error("Error fetching total amount due in /admin/total-amount-due:", error);
        res.status(500).json({ success: false, message: "Failed to fetch total amount due." });
    }
});


router.get('/admin/total-amount-paid', async (req, res) => {
    try {
        // 1. SQL query to separately sum amount_paid_cash and amount_paid_online
        const getTotalAmountPaidQuery = `
            SELECT 
                SUM(amount_paid_cash) AS totalAmountPaidCash,
                SUM(amount_paid_online) AS totalAmountPaidOnline,
                SUM(amount_paid_cash + amount_paid_online) AS totalAmountPaid 
            FROM credit_limit`;

        // 2. Execute the query
        const totalAmountPaidResult = await executeQuery(getTotalAmountPaidQuery);

        // 3. Extract all amounts from the result
        let totalAmountPaidCash = 0;
        let totalAmountPaidOnline = 0;
        let totalAmountPaid = 0;

        if (totalAmountPaidResult.length > 0) {
            totalAmountPaidCash = parseFloat(totalAmountPaidResult[0].totalAmountPaidCash || 0);
            totalAmountPaidOnline = parseFloat(totalAmountPaidResult[0].totalAmountPaidOnline || 0);
            totalAmountPaid = parseFloat(totalAmountPaidResult[0].totalAmountPaid || 0);
        }

        // 4. Respond with all totals
        res.status(200).json({ 
            success: true, 
            totalAmountPaidCash,
            totalAmountPaidOnline,
            totalAmountPaid
        });

    } catch (error) {
        console.error("Error fetching total amounts paid in /admin/total-amount-paid:", error);
        res.status(500).json({ success: false, message: "Failed to fetch total amounts paid." });
    }
});




router.get('/fetch_credit_data', async (req, res) => {
    try {
        const query = 'SELECT * FROM credit_limit'; // Query to select all columns and rows
        const result = await executeQuery(query);

        if (result.length > 0) {
            // Data found in the credit_limit table
            return res.status(200).json({ creditData: result });
        } else {
            // No data found in the credit_limit table (table might be empty)
            return res.status(200).json({ creditData: [], message: "No credit limit data found in the table." });
            // Or, if you want to indicate "no data" as a 404 Not Found (less common for fetching all data, empty result is usually valid):
            // return res.status(404).json({ message: "No credit limit data found in the table." });
        }

    } catch (error) {
        console.error("Error fetching all credit limit data:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message }); // Include error details for debugging
    }
});


router.put('/update_credit_limit', async (req, res) => {
    try {
        const { customerId, creditLimit } = req.body; // Expecting customerId and creditLimit in the request body

        // Validate input
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required in the request body" });
        }
        if (creditLimit === undefined || creditLimit === null || isNaN(Number(creditLimit))) {
            return res.status(400).json({ message: "Valid credit limit is required in the request body" });
        }

        const query = 'UPDATE credit_limit SET credit_limit = ? WHERE customer_id = ?';
        const values = [creditLimit, customerId];

        const result = await executeQuery(query, values);

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: "Credit limit updated successfully" });
        } else {
            return res.status(404).json({ message: "Customer ID not found or credit limit update failed" });
        }

    } catch (error) {
        console.error("Error updating credit limit:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

router.post('/increase-credit-limit', async (req, res) => { // Use POST method as it's for performing an action
    try {
        const { customerId, amountToIncrease } = req.body; // Expecting customerId and amountToIncrease in request body

        // Validate input
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required in the request body" });
        }
        if (amountToIncrease === undefined || amountToIncrease === null || isNaN(Number(amountToIncrease))) {
            return res.status(400).json({ message: "Valid amount to increase is required in the request body" });
        }
        if (Number(amountToIncrease) <= 0) { // Ensure amount to increase is positive
            return res.status(400).json({ message: "Amount to increase must be a positive value" });
        }

        // SQL query to increase the credit limit
        const query = 'UPDATE credit_limit SET credit_limit = credit_limit + ? WHERE customer_id = ?'; // Increment existing credit_limit
        const values = [amountToIncrease, customerId];

        const result = await executeQuery(query, values);

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: "Credit limit increased successfully" });
        } else {
            return res.status(404).json({ message: "Customer ID not found or credit limit update failed (no customer or no credit_limit entry)" });
        }

    } catch (error) {
        console.error("Error increasing credit limit:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

//Financial reporting sections



router.get('/get_customer_transaction_details', async (req, res) => { // Keeping the same endpoint name, can be renamed
    try {
        const query = `
            SELECT
                cl.customer_id,
                cl.customer_name,
                cl.amount_due,
                SUM(pt.payment_amount) AS total_amount_paid_customer -- Calculate total paid
            FROM
                credit_limit AS cl
            LEFT JOIN  -- Use LEFT JOIN to include customers even if they have no transactions yet
                payment_transactions AS pt ON cl.customer_id = pt.customer_id
            GROUP BY
                cl.customer_id, cl.customer_name, cl.amount_due -- Group by customer to aggregate payments
            ORDER BY
                cl.customer_name; -- Order by customer name for readability
        `;

        const customerSummaryResult = await executeQuery(query, []); // No values needed

        // Format the results for better presentation
        const formattedCustomerSummaries = customerSummaryResult.map(customerSummary => ({
            customer_id: customerSummary.customer_id,
            customer_name: customerSummary.customer_name,
            amount_due: parseFloat(customerSummary.amount_due).toFixed(2),
            total_amount_paid: parseFloat(customerSummary.total_amount_paid_customer || 0).toFixed(2), // Format total paid, handle NULL if no payments yet
        }));

        if (formattedCustomerSummaries.length === 0) {
            return res.status(404).json({ message: "No customers found" }); // Updated message
        }

        res.status(200).json(formattedCustomerSummaries); // Send array of customer summary objects

    } catch (error) {
        console.error("Error fetching cumulative customer payment summaries:", error); // Updated error message
        res.status(500).json({ message: "Failed to fetch cumulative customer payment summaries" }); // Updated error message
    }
});



router.get('/get_customer_credit_summaries', async (req, res) => { // Renamed endpoint to be more descriptive
    try {
        const query = `
            SELECT
                customer_id,
                customer_name,
                credit_limit,
                amount_due,
                amount_paid_cash,
                amount_paid_online
            FROM
                credit_limit
            ORDER BY
                customer_name; -- Order by customer name for readability
        `;

        const customerCreditSummaryResult = await executeQuery(query, []); // No values needed

        // Format the results for better presentation
        const formattedCustomerCreditSummaries = customerCreditSummaryResult.map(customerCredit => {
            const totalAmountPaid = parseFloat(customerCredit.amount_paid_cash || 0) + parseFloat(customerCredit.amount_paid_online || 0); // Calculate total paid

            return {
                customer_id: customerCredit.customer_id,
                customer_name: customerCredit.customer_name,
                credit_limit: parseFloat(customerCredit.credit_limit).toFixed(2),
                amount_due: parseFloat(customerCredit.amount_due).toFixed(2),
                total_amount_paid: totalAmountPaid.toFixed(2), // New field: Total Paid (cash + online)
            };
        });

        if (formattedCustomerCreditSummaries.length === 0) {
            return res.status(404).json({ message: "No customers found" }); // Message updated
        }

        res.status(200).json(formattedCustomerCreditSummaries); // Send array of customer credit summary objects

    } catch (error) {
        console.error("Error fetching customer credit summaries:", error); // Error message updated
        res.status(500).json({ message: "Failed to fetch customer credit summaries" }); // Error message updated
    }
});

router.post('/payment-response', (req, res) => {
    console.log('----- Payment Response POST request received -----');
    console.log('Request Headers:', req.headers);
    console.log('Request Body:', req.body);
    console.log('Request Query:', req.query);

    const msgParam = req.body.msg;
    let responseJson = {};
    let statusCode = 200;

    if (msgParam) {
        console.log('Raw msg parameter:', msgParam);
        const msgParts = msgParam.split('|');
        const txnStatus = msgParts[0];
        console.log('Parsed txn_status:', txnStatus);

        responseJson.txn_status_code = txnStatus;
        responseJson.txn_msg = msgParts[1] || 'N/A';
        responseJson.txn_err_msg = msgParts[2] || 'N/A';
        responseJson.clnt_txn_ref = msgParts[3] || 'N/A';
        responseJson.tpsl_txn_id = msgParts[5] || 'N/A';
        responseJson.txn_amt = msgParts[6] || 'N/A';
        responseJson.ref = msgParts[3] || 'N/A';
        responseJson.txnId = msgParts[5] || 'N/A';

        if (txnStatus === '0300') {
            responseJson.status = "success";
        } else {
            statusCode = 400;
            responseJson.status = "failure";
        }

        // Save to file
        const filename = 'payment_response.txt';
        const textData = `Payment Response Data:\n${JSON.stringify(responseJson, null, 2)}`;
        fs.writeFile(filename, textData, (err) => {
            if (err) {
                console.error('Error writing to TXT file:', err);
            } else {
                console.log(`Data saved to ${filename}`);
            }
        });

        // Directly redirect to the app
        res.redirect('reyss-app://');
    } else {
        console.log('Error: No "msg" parameter found in POST request body.');
        responseJson.status = "error";
        responseJson.message = "No 'msg' parameter found in request body.";
        res.status(400).json(responseJson);
    }
    console.log('----- End of Payment Response POST request -----');
});

router.get('/get-payment-response-data', (req, res) => {
    const filename = 'payment_response.txt';

    fs.readFile(filename, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading TXT file:', err);
            if (err.code === 'ENOENT') { // File not found error
                return res.status(404).send({ message: 'Payment response data file not found.' });
            } else {
                return res.status(500).send({ message: 'Failed to read payment response data file.' });
            }
        } else {
            // File read successfully, send the content as plain text response
            res.status(200).send(data);
        }
    });
});

//update online payments


router.post('/collect_online', async (req, res) => {
    try {
        let customerId = req.query.customerId || req.body.customerId;
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        const { online } = req.body; // Changed from 'cash' to 'online'

        // Fetch current customer data
        const fetchQuery = `
            SELECT amount_due, amount_paid_online, credit_limit  -- Changed to amount_paid_online
            FROM credit_limit
            WHERE customer_id = ?`;
        const customerDataResult = await executeQuery(fetchQuery, [customerId]);

        if (customerDataResult.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        const { amount_due, amount_paid_online = 0, credit_limit = 0 } = customerDataResult[0]; // Changed to amount_paid_online
        let updatedAmountDue = amount_due;
        let newAmountPaidOnline = amount_paid_online; // Initialize for online payment

        if (online !== undefined && online !== null) { // Changed from 'cash' to 'online'
            const parsedOnline = parseFloat(online); // Changed from 'parsedCash' to 'parsedOnline'
            if (isNaN(parsedOnline) || parsedOnline < 0) { // Changed from 'parsedCash' to 'parsedOnline'
                return res.status(400).json({ message: "Invalid online amount. Must be a non-negative number." }); // Updated message
            }

            newAmountPaidOnline = amount_paid_online + parsedOnline; // Changed to amount_paid_online and parsedOnline
            updatedAmountDue = Math.max(0, amount_due - parsedOnline); // Changed from 'parsedCash' to 'parsedOnline'
            const newCreditLimit = credit_limit + parsedOnline; // Changed from 'parsedCash' to 'parsedOnline'

            // **1. Insert into payment_transactions table**
            const insertTransactionQuery = `
                INSERT INTO payment_transactions (customer_id, payment_method, payment_amount, payment_date)
                VALUES (?, ?, ?, NOW())`; // NOW() gets current datetime in MySQL
            const transactionValues = [customerId, 'online', parsedOnline]; // Changed payment_method to 'online' and parsedCash to parsedOnline
            await executeQuery(insertTransactionQuery, transactionValues);

            // **2. Update credit_limit table**
            const updateQuery = `
                UPDATE credit_limit
                SET amount_paid_online = ?, amount_due = ?, credit_limit = ?, online_paid_date = UNIX_TIMESTAMP() -- Changed to amount_paid_online and online_paid_date
                WHERE customer_id = ?`;
            const updateValues = [newAmountPaidOnline, updatedAmountDue, newCreditLimit, customerId]; // Changed to newAmountPaidOnline
            await executeQuery(updateQuery, updateValues);

            // 3. Delete payment_response.txt after success (callback-based)
            const filePath = 'payment_response.txt';
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting ${filePath}:`, err);
                    // Log error but don’t fail the request
                } else {
                    console.log(`Deleted ${filePath}`);
                }
            });
            

            return res.status(200).json({
                message: "Online payment collected and transaction recorded successfully", // Updated message
                updatedAmountPaidOnline: newAmountPaidOnline, // Changed to updatedAmountPaidOnline
                updatedAmountDue,
                updatedCreditLimit: newCreditLimit,
                updatedOnlineCreditLimit: newCreditLimit // Added for consistency, same value as updatedCreditLimit
            });
        }

        return res.status(200).json({ amountDue: updatedAmountDue });
    } catch (error) {
        console.error("Error processing online payment collection:", error); // Updated error message
        return res.status(500).json({ message: "Internal server error" });
    }
});


//remarks handling.

// API endpoint to update remarks in the remarks table
router.post("/remarks-update", async (req, res) => {
    try {
        const { customer_id, order_id, remarks } = req.body;

        // Validate input
        if (!customer_id || !order_id || !remarks) {
            return res.status(400).json({ message: "customer_id, order_id, and remarks are required" });
        }

        // SQL INSERT query to add a new remark
        const query = "INSERT INTO remarks (customer_id, order_id, remarks) VALUES (?, ?, ?)";
        const values = [customer_id, order_id, remarks];

        // Execute the query
        const result = await executeQuery(query, values);

        if (result.affectedRows > 0) {
            return res.status(200).json({ message: "Remarks updated successfully" }); // "Updated" is used for consistency with original example, but "added" or "saved" might be more accurate for an INSERT operation. Consider changing the message if needed for clarity.
        } else {
            return res.status(400).json({ message: "Failed to add remarks. Please check customer_id and order_id." }); // 400 status because the request itself might be valid, but the action failed due to data issue. Could also be 500 depending on error details from DB.
        }
    } catch (error) {
        console.error("Error updating remarks:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message }); // Include error.message for more detailed debugging in development. Remove or redact in production.
    }
});


//fetch remarks 



router.get("/fetch-remarks", async (req, res) => {
    try {
        // SQL SELECT query to fetch all remarks
        const query = "SELECT * FROM remarks";

        // Execute the query
        const remarks = await executeQuery(query);

        // Return the fetched remarks in the response
        return res.status(200).json({
            message: "Remarks fetched successfully",
            remarks: remarks // Sending back the fetched remarks data
        });

    } catch (error) {
        console.error("Error fetching remarks:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message }); // Include error.message for more detailed debugging in development. Remove or redact in production.
    }
});





router.get("/customer-product-price", async (req, res) => {
    const productId = req.query.product_id; // Get product_id from query parameters
    const customerId = req.query.customer_id; // Get customer_id (optional)

    if (!productId) {
        return res.status(400).json({ message: "Product ID is required" }); // Validate product_id
    }

    try {
        // 1. Fetch product from 'products' table to get default prices
        const productQuery = "SELECT price, discountPrice FROM products WHERE id = ?"; // Assuming 'id' is product ID column
        const productResults = await executeQuery(productQuery, [productId]);

        if (productResults.length === 0) {
            return res.status(404).json({ message: "Product not found" }); // Product ID not found
        }
        const product = productResults[0]; // Assuming query returns an array, take the first result

        let effectivePrice = product.discountPrice !== null ? product.discountPrice : product.price; // Default price logic

        // 2. Check for customer-specific price if customerId is provided
        if (customerId) {
            const customerPriceQuery = "SELECT customer_price FROM customer_product_prices WHERE customer_id = ? AND product_id = ?";
            const customerPriceResults = await executeQuery(customerPriceQuery, [customerId, productId]);

            if (customerPriceResults.length > 0) {
                effectivePrice = customerPriceResults[0].customer_price; // Override with customer-specific price
            }
        }

        // 3. Return the effective price
        return res.status(200).json({
            message: "Product price fetched successfully",
            effectivePrice: effectivePrice
        });

    } catch (error) {
        console.error("Error fetching customer product price:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

router.get("/fetch-payment-transactions", async (req, res) => {
    try {
        const customerId = req.query.customer_id;
        const date = req.query.date; // YYYY-MM-DD format
        const paymentMethod = req.query.payment_method; // 'cash' or 'online'

        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        // Base query
        let query = "SELECT * FROM payment_transactions WHERE customer_id = ?";
        const params = [customerId];

        // Add date filter
        if (date) {
            query += " AND DATE(payment_date) = ?";
            params.push(date);
        }

        // Add payment method filter
        if (paymentMethod && ['cash', 'online'].includes(paymentMethod)) {
            query += " AND payment_method = ?";
            params.push(paymentMethod);
        }

        // Execute the query
        const transactions = await executeQuery(query, params);

        if (transactions.length === 0) {
            return res.status(404).json({ message: "No transactions found" });
        }

        return res.status(200).json({
            message: "Payment transactions fetched successfully",
            transactions: transactions
        });
    } catch (error) {
        console.error("Error fetching payment transactions:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});



router.get("/fetch-all-payment-transactions", async (req, res) => {
    try {
        const date = req.query.date; // YYYY-MM-DD format
        const paymentMethod = req.query.payment_method; // 'cash' or 'online'

        // Base query to fetch all transactions
        let query = "SELECT * FROM payment_transactions";
        const params = [];

        // Add date filter if provided
        if (date) {
            query += " WHERE DATE(payment_date) = ?";
            params.push(date);
        }

        // Add payment method filter if provided
        if (paymentMethod && ['cash', 'online'].includes(paymentMethod)) {
            query += date ? " AND payment_method = ?" : " WHERE payment_method = ?";
            params.push(paymentMethod);
        }

        // Execute the query
        const transactions = await executeQuery(query, params);

        if (transactions.length === 0) {
            return res.status(404).json({ message: "No transactions found" });
        }

        return res.status(200).json({
            message: "All payment transactions fetched successfully",
            transactions: transactions
        });
    } catch (error) {
        console.error("Error fetching all payment transactions:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});



router.get("/fetch-names", async (req, res) => {
    try {
        const customerId = req.query.customer_id; // Get customer_id from query params

        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        // SQL SELECT query to fetch the name for a specific customer_id
        const query = "SELECT name FROM users WHERE customer_id = ?";
        
        // Execute the query with customer_id as a parameter to prevent SQL injection
        const results = await executeQuery(query, [customerId]);

        if (results.length === 0) {
            return res.status(404).json({ message: "No user found with this customer ID" });
        }

        // Return the fetched name (assuming 'name' is a column in the users table)
        return res.status(200).json({
            message: "User name fetched successfully",
            name: results[0].name // Assuming one result; return the name field
        });
    } catch (error) {
        console.error("Error fetching user name:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

router.get("/fetch-routes", async (req, res) => {
    try {
        const customerId = req.query.customer_id; // Get customer_id from query params

        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        // SQL SELECT query to fetch the name for a specific customer_id
        const query = "SELECT route FROM users WHERE customer_id = ?";
        
        // Execute the query with customer_id as a parameter to prevent SQL injection
        const results = await executeQuery(query, [customerId]);

        if (results.length === 0) {
            return res.status(404).json({ message: "No user found with this customer ID" });
        }

        // Return the fetched name (assuming 'name' is a column in the users table)
        return res.status(200).json({
            message: "Route fetched successfully",
            route: results[0].route // Assuming one result; return the name field
        });
    } catch (error) {
        console.error("Error fetching user route:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});


router.get("/amount_due", async (req, res) => {
    try {
        // SQL SELECT query to fetch ALL columns from credit_limit table
        const query = "SELECT * FROM credit_limit"; // No WHERE clause

        // Execute the query without any parameters
        const results = await executeQuery(query);

        if (results.length === 0) {
            return res.status(404).json({ message: "No credit limit data found in the table" }); // More general message
        }

        // Return all rows from the credit_limit table
        return res.status(200).json({
            message: "All credit limit data fetched successfully", // Updated message
            creditLimitData: results // Now returning the entire array of results
        });
    } catch (error) {
        console.error("Error fetching all credit limit data:", error); // Updated error message
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

//ietms report


router.get("/item-report", async (req, res) => {
    const reportDate = req.query.date; // Get the date from query parameter, e.g., 'YYYY-MM-DD'

    try {
        let query = `
            SELECT
                u.route AS route,
                op.name AS product_name,
                SUM(op.quantity) AS total_quantity
            FROM
                orders o
            JOIN
                users u ON o.customer_id = u.customer_id
            JOIN
                order_products op ON o.id = op.order_id
        `;

        let whereClause = ''; // To build WHERE clause conditionally
        const queryParams = []; // Parameters for parameterized query

        if (reportDate) {
            whereClause = `WHERE DATE(FROM_UNIXTIME(o.placed_on)) = ?`; // Filter by placed_on date
            queryParams.push(reportDate); // Add date to query parameters
        }

        const groupByAndOrderBy = `
            GROUP BY
                u.route,
                op.name
            ORDER BY
                u.route,
                op.name;
        `;

        query = query + whereClause + groupByAndOrderBy; // Combine query parts

        // Execute the SQL query with parameters
        const results = await executeQuery(query, queryParams);

        if (results.length === 0) {
            return res.status(404).json({ message: "No item report data found for the selected date" });
        }

        return res.status(200).json({
            message: "Item report data fetched successfully",
            itemReportData: results
        });
    } catch (error) {
        console.error("Error fetching item report data with date filter:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});



//invoice push
router.post("/invoice", async (req, res) => {
    try {
        // 1. Extract inputs from the request body
        const { order_id, invoice_id, order_date, invoice_date } = req.body;

        // 2. Validate inputs (basic validation - ensure they are provided)
        if (!order_id || !invoice_id || !order_date || !invoice_date) {
            return res.status(400).json({ message: "Missing required fields: order_id, invoice_id, order_date, and invoice_date are all mandatory." });
        }

        // 3. Check if an invoice record already exists for this order_id
        const checkQuery = "SELECT * FROM invoice WHERE order_id = ?";
        const existingInvoice = await executeQuery(checkQuery, [order_id]);

        // 4. Prepare SQL query for INSERT or UPDATE based on existence
        let query;
        let message;
        if (existingInvoice && existingInvoice.length > 0) {
            // Invoice exists for this order_id, so UPDATE the existing record
            query = `
                UPDATE invoice
                SET invoice_id = ?,
                    order_date = ?,
                    invoice_date = ?
                WHERE order_id = ?
            `;
            message = "Invoice data updated successfully for order_id: " + order_id;
        } else {
            // Invoice does not exist for this order_id, so INSERT a new record
            query = `
                INSERT INTO invoice (order_id, invoice_id, order_date, invoice_date)
                VALUES (?, ?, ?, ?)
            `;
            message = "Invoice data inserted successfully for order_id: " + order_id;
        }

        // 5. Execute the query with parameters (order of values depends on INSERT or UPDATE)
        const values = existingInvoice && existingInvoice.length > 0
            ? [invoice_id, order_date, invoice_date, order_id] // For UPDATE: invoice_id, order_date, invoice_date, WHERE order_id
            : [order_id, invoice_id, order_date, invoice_date];    // For INSERT: order_id, invoice_id, order_date, invoice_date

        const results = await executeQuery(query, values);

        // 6. Handle success and errors
        if (results && results.affectedRows > 0) {
            return res.status(200).json({ // 200 OK - for both UPDATE and INSERT in this context
                message: message,
                orderId: order_id // Return order_id for clarity
            });
        } else {
            // If no rows were affected in UPDATE, it might mean data was the same, which could be considered successful in this scenario of "latest data".
            // If no rows affected in INSERT, it's an issue.  But with the existence check, INSERT should generally succeed if validation passed.
            console.warn("Invoice operation query executed, but no rows might have been affected (or data was unchanged in update). Check data or logic.");
            return res.status(200).json({ message: message + " (No changes may have been applied if data was the same).", orderId: order_id });
        }

    } catch (error) {
        console.error("Error processing invoice data:", error);
        return res.status(500).json({ message: "Internal server error while processing invoice data", error: error.message });
    }
});



router.get("/allowed-shift", async (req, res) => {
    try {
        const { shift } = req.query;

        if (!shift || !['AM', 'PM'].includes(shift)) {
            return res.status(400).json({ message: "Invalid shift parameter. Must be 'AM' or 'PM'.", allowed: false });
        }

        const now = moment.tz('Asia/Kolkata'); // Using 'Asia/Kolkata' for India // Remember to replace 'Your-Timezone'
        const currentHour = now.hour();
        let isShiftAllowed = false;

        if (shift === 'AM') {
            isShiftAllowed = (currentHour >= 6 && currentHour < 14);
        } else if (shift === 'PM') {
            isShiftAllowed = (currentHour >= 12 && currentHour < 22);
        }

        return res.status(200).json({
            message: `Shift ${shift} allowance check successful.`, // More informative message
            allowed: isShiftAllowed
        });

    } catch (error) {
        console.error("Error checking shift allowance:", error);
        return res.status(500).json({ message: "Internal server error while checking shift allowance", error: error.message, allowed: false }); // Include allowed: false in error response
    }
});
module.exports = router;


  


