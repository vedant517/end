import express from "express";
import { 
  getOrders, 
  updateOrder, 
  getOrderStats,
  getOrderCancellationDetails,
  createManualOrder,
} from "../controllers/orderController.js";
import { createOrder, getUserOrders, cancelOrder } from "../../User/controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ⚠️ Static routes MUST come before param routes (/:orderId) to avoid being swallowed
router.get("/stats", protect, authorize('admin'), getOrderStats);
router.get("/my-orders", protect, getUserOrders);
router.post("/manual", protect, authorize('admin'), createManualOrder);

// Order list and creation
router.route("/")
  .get(protect, getOrders) 
  .post(protect, (req, res, next) => {
    if (req.user?.role === "admin") {
      return createManualOrder(req, res, next);
    }
    return createOrder(req, res, next);
  });

// Param routes (/:orderId) must come LAST
router.post("/cancel/:orderId", protect, authorize('admin'), cancelOrder);
router.get("/:orderId/cancellation", protect, authorize('admin'), getOrderCancellationDetails);
router.put("/:orderId", protect, authorize('admin'), updateOrder);


export default router;
