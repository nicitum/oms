const adminService = require("../services/adminService");
const bcrypt = require("bcryptjs");

exports.addUserController = async (req, res) => {
  try {
    const { customer_id, username, name, password,route } = req.body;

    if (!customer_id || !username || !name || !password) {
      return res.status(400).json({
        status: false,
        message: "customer_id, username, name, and password are required.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const addResult = await adminService.addUserService({
      customer_id,
      username,
      name,
      route,
      password: hashedPassword,
    });

    res.status(addResult.statusCode).send(addResult.response);
  } catch (error) {
    console.error("Error in addUserController:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.getAllOrdersController = async (req, res) => {
  try {
    const params = req.query;

    const result = await adminService.getAllOrdersService(params);

    res.status(result.statusCode).send(result.response);
  } catch (error) {
    console.error("Error in getAllOrdersController:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.setAmOrderController = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || !products.length) {
      return res.status(400).json({
        status: false,
        message: "Not valid products",
      });
    }

    const result = await adminService.setAmOrderService(products);

    res.status(result.statusCode).send(result.response);
  } catch (error) {
    console.error("Error in setAmOrderController:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to set AM Order products.",
    });
  }
};

exports.getAllUsersController = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const getResponse = await adminService.getAllUsersService(searchQuery);

    res.status(getResponse.statusCode).send(getResponse.response);
  } catch (error) {
    console.error("Error in getAllUsersController:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get users.",
    });
  }
};

exports.addProductController = async (req, res) => {
  try {
    const { name, brand, category, price, discountPrice, hsn_code, gst_rate } = req.body;
   

    if (!name || !category || !price || !brand) {
      return res.status(400).json({
        status: "error",
        message: "Required fields: name, category, and price.",
      });
    }

    const productData = {
      name,
      brand,
      category,
      price,
      discountPrice: discountPrice || 0,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
      hsn_code: hsn_code || "",
      gst_rate: gst_rate || 0
    };

    const addResponse = await adminService.addProductService(productData);
 

    res.status(addResponse.statusCode).send(addResponse.response);
  } catch (error) {
    console.error("Error in addProductController:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to add product.",
    });
  }
};


exports.updateUserController = async (req, res) => {
  try {
    const { customer_id } = req.query;
    if (!customer_id) {
      return res
        .status(401)
        .json({ status: false, message: "Unauthorized access" });
    }
    const result = await adminService.updateUserService(customer_id, req.body);
    res.status(result.statusCode).send(result.response);
  } catch (error) {
    console.error("Error in updateUser:", error);
    res.status(500).json({ status: false, message: "Failed to update user." });
  }
};

exports.updateProductController = async (req, res) => {
  try {
    const { id } = req.query; // Get product ID from URL params
    const { name, brand, category, price, discountPrice, uom, hsn_code, gst_rate } = req.body;

    // Validate required fields
    if (!id || !name || !category || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Set the default value for uom to 'pkts' if not provided
    const updatedProductData = {
      name,
      brand,
      category,
      price,
      discountPrice: discountPrice || null,
      uom: uom || "pkts",
      hsn_code: hsn_code || "",
      gst_rate: gst_rate || 0,
    };

    // Call the service to update the product
    const updatedProduct = await adminService.updateProductService(
      id,
      updatedProductData
    );

    // Respond with the updated product details
    res.status(updatedProduct.statusCode).json(updatedProduct.response);
  } catch (error) {
    console.error("Error in updateProduct controller:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.approveDefectReportController = async (req, res) => {
  const { reportId, orderId } = req.body;

  if (!reportId || !orderId) {
    return res
      .status(400)
      .json({ message: "Missing required fields: reportId, orderId" });
  }

  try {
    const result = await adminService.updateOrderAfterDefectApprovalService(
      reportId,
      orderId
    );

    return res.status(200).json({
      message:
        "Defective products approved and removed from the order successfully.",
      result,
    });
  } catch (error) {
    console.error("Error approving defect report:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
